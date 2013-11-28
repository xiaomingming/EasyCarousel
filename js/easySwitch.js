/*
* author:leweiming
* gmail:xmlovecss 艾特 gmail dot com
* 一个简单的轮播
* 轮播的图片宽度应当一致
* 轮播特效分为 移动，fadeIn/fadeOut两种
* 移动又分为left,top两种方式
* 支持配置上一张，下一张按钮
* 支持配置轮播分页
* 支持悬浮图片停止/继续 轮播
* 支持自适应
* 支持最外层类名配置，分页类名配置，上一张，下一张按钮类名配置
* 对于上一张，下一张按钮的文字配置，考虑到实际，还是写死算了，你们会用图片的
* example:
*　$(window).load(function(){
    $('.switch-list').easySwitch({
        'effect': 'fadeEffect', // fadeEffect or moveEffect
        'moveDirection': 'left', //left or top 
        'isHoverPause': true,
        'isPlayNumber': true,
        'isDirbtn': true,
        'startIndex': 0,
        'intervalTime': 3000,
        'effectDuration': 800
    });
*　});
*/
/*
* 实现效果：自动播放时，始终向左/向上滑动，点击播放数字时，会有前后/上下滑动，点击上一张和下一张时，始终向一个方向（水平为left,right;垂直为top,bottom）
* 实现原理：假设方向为水平方向，那么从第一张滑动到第二张。第二张图片要往左滑动的同时，第一张图片也要往左滑动（也有另一种滑动效果，第一张图片是不动的，第二张图片直接覆盖上去）
* 这样的话，我们需要计算好轮播的当前下标index和当前状态的前一个图片的下标index。使用绝对定位，同时显示两者，并准备好当前图片的位置。
* 并隐藏其它图片，其它图片层叠值设为0，当前为2，前一个为1。动画完成后，把当前的层叠值恢复为1，前一个图片样式清空，打成平民。
* 点击播放数字时，图片要么向前，要么向后（垂直方向不陈述了），判断前后的标准是通过 当前 和 前一个 图片的 下标差 来判断
* 那么，怎么知道是点击呢，还是自动轮播呢？因为点击时需要停止timer，所以timer不存在就是点击状态
* 点击上一张，下一张时，行为和点击数字不一样，需要区别对待，但是这里逻辑非常简单了
* 另外，对于动画状态的判断需要格外注意了。这里设置了全局动画标识，所有的事件逻辑最终要走向scroll函数，那么，当动画还在进行时，点击事假是不能生效的。
* 让点击事件不能生效的技巧就是，通过判断动画标识，在scroll函数中更改轮播下标 startIndex。
*/
;(function(window, $, undefined) {
    var my = {},
        constructorFunName = 'Eswitch',
        pluginName = 'easySwitch';

    my[constructorFunName] = function(container, options) {
        var self = this,
            imgEle;
        this.container = container;
        var settings = $.extend({}, $.fn[pluginName].defaults, options);
        this.timer = null;
        // 获取设置的初始滚动下标
        this.startIndex = settings.startIndex;
        // 获取图片宽高
        imgEle = container.find('li img').eq(this.startIndex);
        // 显示才能获取宽高
        imgEle.parents('li').addClass('prev');

        this.width = imgEle.width() || this.container.width();
        this.height = imgEle.height() || this.container.height();
        // 类名获取
        this.switchWrapperName = settings.switchWrapperName;
        this.switchNumberName = settings.switchNumberName;
        this.prevBtnName = settings.prevBtnName;
        this.nextBtnName = settings.nextBtnName;
        // 获取图片个数
        this.itemsLen = this.container.find('li').length;
        // 全局timer，动画状态判断
        this.timer = null;
        this.isAnimating = false;
        // 获取延迟
        this.intervalTime = settings.intervalTime;
        // 获取动画effectDuration
        this.effectDuration = settings.effectDuration;
        // 是否创建播放数字
        this.isPlayNumber = settings.isPlayNumber;
        // 是否创建前进后退按钮
        this.isDirbtn = settings.isDirbtn;
        // 是否悬浮停止播放
        this.isHoverPause = settings.isHoverPause;
        // 特效支持
        // 包括移动展示，fadeIn fadeOut
        this.effect = settings.effect;
        // 移动方向
        this.moveDirection = settings.moveDirection;
        // 移动的宽度或者高度
        this.moveLenConfig = {
            'left': self.width,
            'top': self.height
        };
        this.moveLen = this.moveLenConfig[this.moveDirection];
        // 移动的动画配置
        // 分为当前动画，前一个状态的动画及样式设置
        this.moveAnimateConfig = {
            currentE: {
                animate: {},
                css: {}
            },
            prevE: {
                animate: {},
                css: {}
            }
        };

        this.moveAnimateConfig.currentE.animate[self.moveDirection] = 0;
        this.moveAnimateConfig.prevE.animate[self.moveDirection] = 0;

        this.moveAnimateConfig.currentE.css[self.moveDirection] = 0;
        // 初始化
        this.init();
    };
    my[constructorFunName].prototype = {
        constructor: my[constructorFunName],
        // 滚动初始化
        init: function() {
            var self = this;
            this.setContainerStyle();
            // this.container.find('li').eq(this.startIndex).addClass('prev');
            this.isPlayNumber && this.renderPlayNumber();
            this.isDirbtn && this.renderDirectionBtn();
            // 自动播放
            this.autoSwitch();
            // 悬浮停止配置
            this.isHoverPause && this.container.on('mouseover', function() {
                self.stopSwitch();
            }).on('mouseout', function() {
                self.autoSwitch();
            });
        },
        // 设置图片列表ul宽高
        setContainerStyle: function() {
            var self = this;
            this.container.css({
                'width': self.width,
                'height': self.height
            });
        },
        // 若有分页，或者前进，后退按钮
        // 需要创建一个外层包含框
        createSwitchWrapper: function() {
            if (!this.isSwitchWrapperCreated) {
                this.isSwitchWrapperCreated = true;
                return '<div class="'+this.switchWrapperName+'" style="width:' + this.width + 'px;height:' + this.height + 'px"></div>';
            } else {
                return false;
            }
        },
        // 创建分页
        createPlayNumber: function() {
            var i = 0,
                j = this.itemsLen,
                tmp = '<div class="'+this.switchNumberName+'">';
            for (; i < j; i++) {
                if (i === this.startIndex) {
                    tmp += '<a href="#" class="current">' + (i + 1) + '</a>';
                } else {
                    tmp += '<a href="#">' + (i + 1) + '</a>';
                }
            }
            tmp += '</div>';
            return tmp;
        },
        // 渲染
        renderPlayNumber: function() {
            var switchWrapper = this.createSwitchWrapper(),
                self = this;
            // this.playNumber = self.createPlayNumber();
            if (switchWrapper) {
                this.container.wrap(switchWrapper);
            }
            this.container.parent().append(self.createPlayNumber());
            this.playNumberEvent();

        },
        // 绑定数字播放事件
        playNumberEvent: function() {
            var self = this;

            this.container.parent().find('.'+this.switchNumberName).on('click', 'a', function(e) {
                e.preventDefault();
                self.gotoIndex($(this).index(), self.startIndex, '');
            });
        },
        // play number
        playNumber: function(index) {
            var self = this;
            this.container.parent().find('.'+this.switchNumberName).find('a').eq(index).addClass('current').siblings().removeClass('current');
        },
        gotoIndex: function(index, prevIndex, directionFlag) {
            // 停止轮播
            var self = this;
            this.stopSwitch();

            // self.startIndex = index;
            // 
            this.scroll(index, prevIndex, directionFlag);
            this.autoSwitch();
        },

        // create next,prev button
        createDirectionBtn: function() {
            return '<a href="#" class="'+this.prevBtnName+'">上一张</a><a href="#" class="'+this.nextBtnName+'">下一张</a>';
        },
        // render next,prev button
        renderDirectionBtn: function() {
            var switchWrapper = this.createSwitchWrapper(),
                self = this;

            if (switchWrapper) {
                this.container.wrap(switchWrapper);
            }
            this.container.parent().append(self.createDirectionBtn());
            this.prevBtnEvent();
            this.nextBtnEvent();
        },
        // 上一张按钮事件
        prevBtnEvent: function() {
            var self = this,
                clickIndex;

            this.container.parent().find('.'+this.prevBtnName).on('click', function(e) {
                e.preventDefault();
                clickIndex = self.getPrev(self.startIndex);
                self.gotoIndex(clickIndex, self.startIndex, -1);
            });
        },
        // 下一张按钮事件
        nextBtnEvent: function() {
            var self = this,
                clickIndex;
            this.container.parent().find('.'+this.nextBtnName).on('click', function(e) {
                e.preventDefault();
                clickIndex = self.getNext(self.startIndex);
                self.gotoIndex(clickIndex, self.startIndex, 1);
            });
        },
        // get direction
        // 传入跳转后的下标，跳转之前的下标
        getDirection: function(gotoIndex, prevIndex) {
            var res = gotoIndex - prevIndex;
            if (res >= 1) {
                // 正向跳转
                return 1;
            } else if (res < 0) {
                // alert('-1');
                // 负向跳转
                return -1;
            } else {
                // 根本就没有跳转么
                return 0;
            }
        },
        // get 前一张
        getPrev: function(index) {
            return (index === 0) ? (this.itemsLen - 1) : (index - 1);
        },
        // 获取下一张
        getNext: function(index) {
            return (index + 1 === this.itemsLen) ? 0 : (index + 1);
        },
        // 获取移动的距离
        // 根据方向参数，自动播放/手动播放标识 来判断
        // 由于上一页，下一页按钮行为特殊，比如，下一页点到最后时，它的下一页就是起始，在两者跳转时，就不同于在分页上的点击那样跳转方向不一致，这个必须一致
        getMoveDistance: function(index, prevIndex, directionFlag) {
            var moveLen = this.moveLen;
            if (directionFlag === '') {
                //前进或后退，首尾图片切换方向不一致时
                return (this.timer) ? moveLen : this.getDirection(index, prevIndex) * moveLen;
            } else {
                return directionFlag * moveLen;
            }

        },
        // 滚动回调
        scroll: function(index, prevIndex, directionFlag) {
            if (this.isAnimating) {
                return;
            }

            this.isAnimating = true;
            // 更改开始的下标
            // 这句相当关键，动画状态正在运动时，就不能让startIndex更改了，而放置的最佳位置，就是这里
            this.startIndex = index;
            var self = this,
                moveDistance = 0,
                container = this.container,
                currentEle = container.find('li').eq(index),
                prevEle = container.find('li').eq(prevIndex),
                promiseCurrent,
                promisePrev;
            // 先移除current next类
            container.find('li').removeClass('current prev');

            // 移动效果
            if (this.effect === 'moveEffect') {
                moveDistance = this.getMoveDistance(index, prevIndex, directionFlag);
                self.moveAnimateConfig.currentE.css[self.moveDirection] = moveDistance + 'px';
                self.moveAnimateConfig.prevE.animate[self.moveDirection] = -moveDistance + 'px';

                // 当前
                promiseCurrent = currentEle.addClass('current').css(self.moveAnimateConfig.currentE.css).stop(true, true).animate(self.moveAnimateConfig.currentE.animate, self.effectDuration, 'linear', function() {
                    $(this).siblings().removeClass('prev').attr('style', '');
                    $(this).css('z-index', '1');
                }).promise();

                // 当前图片的前一个
                promisePrev = prevEle.addClass('prev').stop(true, true).animate(self.moveAnimateConfig.prevE.animate, self.effectDuration, 'linear', function() {
                    $(this).attr('style', '');
                }).promise();
            }
            // fade 效果
            if (this.effect === 'fadeEffect') {
                promiseCurrent = currentEle.stop(true, true).fadeIn(self.effectDuration).promise();
                promisePrev = prevEle.stop(true, true).fadeOut(self.effectDuration).promise();
            }
            // 效果这里控制，本来使用key/value来进行控制，这样代码显得优雅
            // 但是，在$.when()中，作为参数，产生了问题，于是这里代码就先ugly着
            $.when(promiseCurrent, promisePrev).done(function() {
                self.isAnimating = false;
                self.isPlayNumber && self.playNumber(index);
            });
        },
        // 触发自动滚动
        autoSwitch: function() {
            var self = this,
                perveIndex;
            this.timer = setInterval(function() {
                pervIndex = self.startIndex;
                self.startIndex = self.getNext(self.startIndex);
                self.scroll(self.startIndex, pervIndex, 1);
            }, self.intervalTime);
        },
        // 阻止滚动
        stopSwitch: function() {
            var self = this;
            if (this.timer) {
                clearInterval(self.timer);
                self.timer = null;
            }
        }
    };
    $.fn[pluginName] = function(opts) {
        // 可初始化并自定义属性及函数
        if (typeof opts === 'string') {
            if (opts === 'api') {
                return $(this).data('plugin-' + pluginName);
            } else {
                throw new Error('error string ,here supports "api" only!');
            }
        }
        return this.each(function() {
            var that = $(this),
                s1 = new my[constructorFunName](that, opts);

            if (!that.data('plugin-' + pluginName)) {
                return that.data('plugin-' + pluginName, s1);
            }

        });

    };
    $.fn[pluginName].defaults = {
        'switchWrapperName': 'switch-wrapper',
        'switchNumberName': 'switch-number',
        'prevBtnName': 'switch-prev',
        'nextBtnName': 'switch-next',
        'effect': 'moveEffect', // fadeEffect or moveEffect
        'moveDirection': 'left', //left or top
        'isHoverPause': true,
        'isPlayNumber': true,
        'isDirbtn': true,
        'startIndex': 0,
        'intervalTime': 3000,
        'effectDuration': 800
    };
})(window, jQuery);