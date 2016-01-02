﻿define(function(require, exports, module){
	//require('jQuery');
	/**
	 * @class refreshPull
	 * @memberof Nuui
	 * @classdesc 带索引的联系人列表<br/>
	 *		接收联系人信息的数据, 生成联系人列表, 右侧有拼音索引条,
	 * @param {$} $target - 联系人名单列表的容器
	 * @param {object} config - 配置
	 * @param {string} config.data - 联系人信息数据<br/>
	 * @param {string} config.dataIndexName - data数据里的包含拼音属性的名称<br/>
	 * @param {string} config.indexContainer - 索引条的位置, 默认为view<br/>
	 * @param {string} config.containerHeight - 容器的高度, 必须提供, 否则为屏幕高度<br/>
	 * @param {func} config.renderer - 自定义html模板渲染页面, 接收参数1为单个联系人数据, 参数2为该联系人在列表的序号<br/>
	 * @param {view} view - 当前的view,一定要填
	 * @example App.request("key.do", {success:function(resp){
	 * 	new RefreshPull($('#indexedList'), {
	 * 		data: resp,
	 * 		dataIndexName: 'spell',
	 * 		renderer: function(data, i){
	 * 			return $('<div>').html(
	 * 				'<span>' + data.spell + '</span>' +
	 * 				'<span>' + data.name + '</span>' +
	 * 				'<span>' + data.phone + '</span>'
	 * 			);
	 * 		}
	 * 	});
	 */

	/*
	* 分析事件:
	* 1, 获取容器, 获取容器内部的内容div, 不一定要求容器是scroll属性
	* 2, 生成icon在容器内第一级, 生成两个icon
	* 3, 对容器还是内容绑定事件:
	*   1, 接触开始: 立即显示icon, icon位置 = -scrollTop (相对于容器顶部)
	*   2, 滑动时候, 变化icon位置, 随着触控距离在y轴上的距离而变动, 且有rotateZ值同步变化
	*   3, 释放触控时:
	*       1, 进行判断: 是否refresh
	*           1, 是: 动画icon旋转
	*           2, 否, icon弹回顶部位置
	*   4, 拖拽icon的时候反方向拉的话要禁止默认事件
	*
	* 动画技术: rotateZ, keyframe, animate/requestAnimationFrame
	*   icon的y轴活动就不需要translate了, 不需要很好的动画性能, 只调整css的xy就可以, 因为要刷新的key动画, 所以transform只有rotateZ的活动!
	*
	*
	* 优化历史:
	* 1, 拖拽到loading的条件, 释放触控时让icon有流畅的回滚
	*   思路:  避免icon在回滚时候出现闪烁跳动
	*   方法1: 使用keyframes从无条件状态到0deg, 这样释放拖拽可以保证从变动的deg开始回滚, 而animation时间可以重新计算reRunDuration以稳定旋转速度,
	*          但问题在于不断滚下去, 回到0deg的时候会有闪烁跳到释放拖拽时的deg, 我试过设定时reRunDuration后把icon的角度设为0deg再把reRunDuration时间调整好正常的一圈时间, 但还是由明显的闪烁跳到, 我想应该是动画时间与js定时不同步!
	*   方法2: 混合模式: 先js控制, 释放触控时先设icon的角度为整除360后的余数, 使用animate方法过渡变化为0deg,
	*          callback是使用CSS3的animation的动画循环效, 就可以避免闪烁顺利过渡为animation, 且可以不断循环
	*   方法3: js控制, 先设定时器来不断减少deg, 问一下大师效果如何?!
	*
	* */

	var RefreshPull = module.exports = function($target, config, view){

		// 获取环境的设置
		this._setProps();

		// 绑定方法与本对象
		this._startEventFunc = $.proxy(this._startEventFunc, this);
		this._moveEventFunc = $.proxy(this._moveEventFunc, this);
		this._stopEventFunc = $.proxy(this._stopEventFunc, this);
		this.hide = $.proxy(this.hide, this);
		this.load = $.proxy(this.load, this);

		this._$doc = view ? view.$el : $('body');

		this._config = $.extend({}, this._defaultConfig, config);

		this._$container = $target.css('position', 'relative');

		// 根据用户的设定来计算icon拖拽时的滚动速度等等
		this._calcRuns();

		// 生成内容
		this._renderIcon();

		// 设icon位置
		this._setIconPos();

		// 给容器绑定开始事件
		this._$container.on(this._startEvent, this._startEventFunc);
	};

	RefreshPull.prototype = {
		_calcRuns: function(){
			var allRunDeg = this._config.dragRuns * 360;
			
			this._dragDegPerY = allRunDeg / this._config.loadingH;
		
			this._resetDegPerTime = allRunDeg / this._config.resetDuration;
		},

		_renderIcon: function(){
			this._$container.append(
				$('<div class="nu-refreshPull">').append(
					this._$icon = this._config.renderer().css('position', 'absolute')
				)
			);
			this._iconH = this._$icon.height();
		},

		_getScrollTop: function(){
			return this._scrollTop = this._$container.scrollTop();
		},

		_setIconAnimation: function(times, backwardsDuration){
			this._$icon.css({
				'animation-iteration-count': times,
				'animation-duration': backwardsDuration / 1000 + 's'
			});
		},

		_startEventFunc: function(e){
			console.log('_startEventFunc', this._status);
			if(this._status !== 'loaded'){
				return
			}

			this._startY = this._page('y', e);

			this._getScrollTop();
			console.log('start', this._scrollTop);

			this._$container.on(this._moveEvent, this._moveEventFunc);

			this._$container.one(this._stopEvent, this._stopEventFunc);
		},

		_moveEventFunc: function(e){
			var touchY = this._page('y', e);
			var dragY = (touchY - this._startY) - this._scrollTop;

			if(dragY < 0) {
				console.log('还没到容器顶端');
				return
			}

			this._status = 'dragging';
			//console.log('dragging');

			// 拖拽icon的时候要禁止默认事件: 滚动容器内容
			e.preventDefault();

			var iconRunY = dragY * 0.75;// 0.75系数是微信朋友圈的效果

			this._rotateDeg = iconRunY * this._dragDegPerY;

			this._rotateIcon(this._rotateDeg);

			this._dragIcon(iconRunY);
		},

		_stopEventFunc: function(){

			var _this = this, backwardsDuration;

			this._cleanEvent();

			// 没有拖拽icon的话不用执行以下方法
			if(this._status !== 'dragging'){return}

			if(this._iconPosY == (this._config.loadingH + this._initIconPos)){

				/*2 混合模式: 先使用animate方法来调整为0deg, 后使用CSS3的animation的动画循环效果*/
				var backwardsDeg = this._rotateDeg % 360;

				backwardsDuration = backwardsDeg / this. _resetDegPerTime;

				this._rotateIcon(backwardsDeg);

				$({"deg": backwardsDeg})
					.animate({"deg": 0}, {
						duration: backwardsDuration,
						easing: 'linear',
						step: function(now) {
							_this._rotateIcon(now);
						},
						complete: function() {
							_this.load();
						}
					});

				/*方法3*/
				//window.requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
				//function step() {
				//	_this._rotateDeg -= 3;
				//	_this._rotateIcon(_this._rotateDeg);
				//
				//	if (_this._rotateDeg > 0) {
				//		requestAnimationFrame(step);
				//	} else {
				//		_this.load();
				//	}
				//}
				//requestAnimationFrame(step);

				// 外部方法
				this._config.onDragEnd();

			} else {

				this._status = 'return';

				backwardsDuration = this._rotateDeg / this. _resetDegPerTime;

					// 没有拉到最低, 中途释放拖拽的话添加特别的格式, 修改动画时间
				this._$icon.addClass('nu-refreshPull-reset');
				this._setIconAnimation('1', backwardsDuration);

				this.hide(backwardsDuration);
			}

		},

		_cleanEvent: function(){

			this._$container.off(this._moveEvent + " " + this._stopEvent);

		},

		// 默认值
		_defaultConfig : {
			loadingH: 200,
			dragRuns: 2,
			resetDuration: 1000,

			// 外部方法
			onDragEnd: null,

			renderer: function(){
				return $('<span>').html(
					'<img src="./img/nuui.png">'
				);
			}
		},

		/*
		* loading, reset, dragging
		* */
		_status: 'loaded',

		// 方法: 获取触控点坐标
		_page :  function (coord, event) {
			return (this._hasTouch? event.originalEvent.touches[0]: event)['page' + coord.toUpperCase()];
		},

		_dragIcon: function(distance){
			distance = (distance > this._config.loadingH) ? this._config.loadingH : distance;

			var cssY = distance + this._initIconPos;

			if(cssY !== this._iconPosY){
				this._iconPosY = cssY;
				this._$icon.css('top', cssY);
			}
		},

		_setIconPos: function(){
			// 设icon的位置在容器的顶部隐藏
			this._initIconPos = this._getScrollTop() - this._iconH;
			this._$icon.css({top: this._initIconPos + 'px'});
		},

		_rotateIcon: function(rotateDeg, $obj) {
			// 方法setCSS: 即时位置调整
			$obj = $obj || this._$icon;

			$('.showText').text('rotateDeg = ' + rotateDeg);

			var rotateProps = {};

			if (this._transformsEnabled !== false && this._cssTransitions !== false) {
				rotateZ = "rotateZ(" + rotateDeg + "deg)";
				rotateProps[this._animType] = rotateZ;
			}

			$obj.css(rotateProps);
		},

		_setProps: function() {
			// 环境检测可用的css属性: 能否使用transition, 能否使用transform
			var bodyStyle = document.body.style;

			// 选择事件类型, 添加命名空间, 不会与其他插件冲突
			this._hasTouch = 'ontouchstart' in window;
			this._startEvent = this._hasTouch ? 'touchstart.refreshPull': 'mousedown.refreshPull';
			this._stopEvent = this._hasTouch ? 'touchend.refreshPull': 'mouseup.refreshPull';
			this._moveEvent = this._hasTouch ? 'touchmove.refreshPull': 'mousemove.refreshPull';

			if (bodyStyle.WebkitTransition !== undefined ||
				bodyStyle.MozTransition !== undefined ||
				bodyStyle.msTransition !== undefined) {
				//if (this._staticConfig._useCSS === true) { //_config是提供用户的选择, 但要使用的话, 需检测环境能否
					this._cssTransitions = true;
				//}
			}
			/*setProps的主要作用之一:检测可使用的前缀, 可以用来借鉴, Perspective更小众*/
			if (bodyStyle.OTransform !== undefined) {
				this._animType = 'OTransform';
				this._transformType = '-o-transform';
				this._transitionType = 'OTransition';
				this._animationType = '-o-animation';
				if (bodyStyle.perspectiveProperty === undefined && bodyStyle.webkitPerspective === undefined) this._animType = false;
			}
			if (bodyStyle.MozTransform !== undefined) {
				this._animType = 'MozTransform';
				this._transformType = '-moz-transform';
				this._transitionType = 'MozTransition';
				this._animationType = '-moz-animation';
				if (bodyStyle.perspectiveProperty === undefined && bodyStyle.MozPerspective === undefined) this._animType = false;
			}
			if (bodyStyle.webkitTransform !== undefined) {
				this._animType = 'webkitTransform';
				this._transformType = '-webkit-transform';
				this._transitionType = 'webkitTransition';
				this._animationType = '-webkit-animation';
				if (bodyStyle.perspectiveProperty === undefined && bodyStyle.webkitPerspective === undefined) this._animType = false;
			}
			if (bodyStyle.msTransform !== undefined) {
				this._animType = 'msTransform';
				this._transformType = '-ms-transform';
				this._transitionType = 'msTransition';
				this._animationType = '-ms-animation';
				if (bodyStyle.msTransform === undefined) this._animType = false;
			}
			if (bodyStyle.transform !== undefined && this._animType !== false) {
				this._animType = 'transform';
				this._transformType = 'transform';
				this._transitionType = 'transition';
				this._animationType = 'animation';
			}
			this._transformsEnabled =
				//this._staticConfig._useTransform &&
				(this._animType !== null && this._animType !== false);
			//this._transformsEnabled = false;// 测试用
			//this._cssTransitions = false;// 测试用
		},

		/*
		* 进入加载状态, 提供进入页面的时候的加载状态模式提示
		* */
		load: function(){
			// 提供进入页面时候加载的动画滚动效果
			this._$icon.css('top', this._initIconPos + this._config.loadingH + 'px');

			this._status = 'load';

			var addRunTime = 360 / this. _resetDegPerTime;

			this._setIconAnimation('infinite', addRunTime);

			this._$icon.addClass('nu-refreshPull-loading');
		},

		/*
		* 加载完毕的退出方法
		* */
		hide: function(duration){
			var _this = this;

			duration = duration || this._config.resetDuration;

			this._$icon
				.animate(
				{'top': this._initIconPos}, duration, function(){
					_this._$icon.removeClass(
						'nu-refreshPull-loading'
						+ " " +
						'nu-refreshPull-reset'
					);
					_this._rotateIcon(0);

					_this._status = 'loaded';
				});
		}
	}

});