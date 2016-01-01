﻿define(function(require, exports, module){
	//require('jQuery');
	/**
	 * @class indexedList
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
	*
	* 动画技术: transition, rotateZ, translate3D, keyframe
	*   icon的y轴活动就不需要translate了, 不需要很好的动画性能, 只调整css的xy就可以, 因为要刷新的key动画, 所以transform只有rotateZ的活动!
	*
	*   效果:
	*   1, 拉到顶部继续下拉:
	 *      情况A: 1-1, 拉出icon; 1-2, icon同步旋转; 1-3, icon下拉有特定距离, 但旋转没有限制, 与下拉距离同步
	 *      情况B: 情况A中继续拉动, 但向上拉, 若触控上拉到某个位置, icon开始上升回滚
	 *      情况C: 情况B中释放触控, icon回滚隐藏, 但不触发刷新
	 *      情况D: 情况A中释放触控, 若icon到达了特定位置, 触发刷新, 否则回滚不触发刷新
	*   2,
	*
	* 1, 获取数据
	* 2, 以数据生成html: ul list
	*     1, 有标题: 内容是拼音
	* 3, 生成右侧fixed的indexed索引条
	* 4, css样式调整, 根据屏幕高度调整索引条的行距和font-size
	* , 绑定事件, 当滚动到对应拼音位置时候就给对应的索引值添加class
	* , 绑定事件, 在索引条
	*       , touchDown:
	*           , 显示浮动拼音
	*           , 跳转至指定拼音
	*           ,
	*       , mouseMove
	*           , 监听触控点高度, 判断触控点拼音
	*           , 跳转至指定拼音
	*           , 显示/更新浮动拼音
	*       , mouseMove
	*           , 关闭浮动拼音
	*
	* 优化历史:
	*
	* */

	var RefreshPull = module.exports = function($target, config, view){

		this._setProps();

		this._startEventFunc = $.proxy(this._startEventFunc, this);
		this._moveEventFunc = $.proxy(this._moveEventFunc, this);
		this._stopEventFunc = $.proxy(this._stopEventFunc, this);

		this._$doc = view ? view.$el : $('body');

		this._config = $.extend({}, this._defaultConfig, config);

		this._$container = $target.css('position', 'relative');

		this._calcRuns();

		// 生成内容
		this._renderIcon();

		this._initScrollTop = this._getScrollTop();

		this._setIconPos();

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

		_setIconPos: function(){
			this._$icon
				.css({
					//'margin-left': -this._$icon.width()/2 + 'px',
					//'margin-top': -this._initScrollTop/2 + 'px',
					top: this._initScrollTop + 'px'
				});

		},

		_getScrollTop: function(){
			return this._scrollTop = this._$container.scrollTop()// - this._iconH;
		},

		load: function(){
			// 提供进入页面时候加载的动画滚动效果
			this._$icon
				.addClass('nu-refreshPull-loading')
				.css({top:
				this._config.loadingH + 'px'
				}, this._config.resetDuration);
		},


		resetIcon: function(duration){
			var _this = this;

			this._status = 'loaded';

			this._$icon
				.animate(
				{'top': this._initScrollTop}, duration, function(){
					console.error('ending');
					_this._$icon.removeClass(
						'nu-refreshPull-loading'
						+ " " +
						'nu-refreshPull-reset'
					);
					_this._rotateIcon(0);

				});
		},

		backRotateIcon: function(times, backwardsDuration){
			this._$icon.css({
				'animation-iteration-count': times,
				'animation-duration': backwardsDuration / 1000 + 's'
			});
		},

		_startEventFunc: function(e){
			if(this._status !== 'loaded'){return}

			this._startY = this._page('y', e);

			this._getScrollTop();

			this._$container.on(this._moveEvent, this._moveEventFunc);

			this._$container.one(this._stopEvent, this._stopEventFunc);
		},

		_moveEventFunc: function(e){

			e.preventDefault();

			var touchY = this._page('y', e);
			var dragY = touchY - this._startY;

			//console.warn(dragY);

			var limitDragY = dragY * 0.75;

			this._rotateDeg = limitDragY * this._dragDegPerY;

			this._rotateIcon(this._rotateDeg);

			this._dragIcon(limitDragY);
		},

		_stopEventFunc: function(){

			var backwardsDuration = this._rotateDeg / this. _resetDegPerTime;

			var resetTime = this._config.resetDuration;

			//console.warn('this._rotateDeg', this._rotateDeg);
			//console.warn('回去所需时间backwardsDuration ', backwardsDuration);

			//var backwardsRotate = this._rotateDeg % 360;
			//console.warn('this.backwardsRotate', backwardsRotate);

			//this._$icon.css('transition', 'all 1s linear');

			this._cleanEvent();

			console.log('this._iconPosY', this._iconPosY);

			var _this = this;

			if(this._iconPosY == this._config.loadingH){
				// 计算旋转了这么多圈后的回旋时间

				this._status = 'load';

				var addRunTime = 360 / this. _resetDegPerTime;

				/*3 混合模式: 先使用animate方法来调整为0deg, 后使用CSS3的animation的动画循环效果*/
				var backwardsDeg = this._rotateDeg % 360;
				backwardsDuration = backwardsDeg / this. _resetDegPerTime;
				console.log('backwardsDuration', (this._rotateDeg % 360), backwardsDuration);
				var  rotateProps = {};
				rotateZ = "rotateZ(" + (this._rotateDeg % 360) + "deg)";
				rotateProps[this._animType] = rotateZ;
				this._$icon.css(rotateProps);

				$({"deg": backwardsDeg})
					.animate({"deg": 0}, {
						duration: backwardsDuration,
						easing: 'linear',
						step: function(now) {
							_this._rotateIcon(now);
						},
						complete: function() {
							_this.backRotateIcon('infinite', addRunTime);
							_this._$icon.addClass('nu-refreshPull-loading');
						}
					});

				/*思路2 分两次调整animation的动画效果的时间, 但有明显的闪烁*/
				//this._$icon.addClass('nu-refreshPull-loading');
				//backwardsDuration = (this._rotateDeg % 360) / this. _resetDegPerTime + addRunTime;
				//console.log('backwardsDuration', (this._rotateDeg % 360), backwardsDuration);
				//var  rotateProps = {};
				//rotateZ = "rotateZ(" + (this._rotateDeg % 360) + "deg)";
				//rotateProps[this._animType] = rotateZ;
				//this._$icon.css(rotateProps);
				//this.backRotateIcon('1', backwardsDuration);
				//
				//setTimeout(function(){
				//	_this._rotateIcon(0);
				//	_this.backRotateIcon('infinite', addRunTime);
				//}, backwardsDuration);


				/*思路1*/
				//this._$icon.addClass('nu-refreshPull-loading');
				//var ttt = 360 / this. _resetDegPerTime;
				//
				//backwardsDuration += ttt;
				//
				//_this.backRotateIcon('infinite', backwardsDuration);
				//
				//setTimeout(function(){
				//	_this._rotateIcon(0);
				//	_this.backRotateIcon('infinite', ttt);
				//}, backwardsDuration);

			} else {
				this._$icon.addClass('nu-refreshPull-reset');

				//var dragY = this._$icon.position().top;

				//duration = duration * dragY / (this._initScrollTop + this._config.loadingH);

				this.backRotateIcon('1', backwardsDuration);

				this.resetIcon(backwardsDuration);
			}

		},

		_cleanEvent: function(){

			this._$container.off(this._moveEvent + " " + this._stopEvent);

		},

		// 默认值
		_defaultConfig : {
			loadingH: '120',
			dragRuns: 2, // 大于1的话可能reset需要使用transition来处理, 才有效
			//dragRuns: 1,
			resetDuration: 3000,




			data: null, // 联系人信息
			dataIndexName: null, // data数据里的包含拼音属性的名称
			indexContainer: null, //索引条的位置, 默认为view
			containerHeight: null, // 容器的高度, 必须提供, 否则为屏幕高度
			renderer: function(){
				return $('<span>').html(
					'<img src="./img/nuui.png">'
				);
			},
			// className:
			rowClass: 'nu-ilist-row',
			titleClass: 'nu-ilist-title',
			sectionClass: 'nu-ilist-section',
			indexedColClass: 'nu-ilist-indexedCol',
			floatIndexedClass: 'nu-ilist-floatIndexed',
			htmlIndexedName: "spell-indexed",
			activeClass: "nu-ilist-activeIndexed",
			activeFormerOneClass: "nu-ilist-activeFormerOneIndexed",
			activeFormerTwoClass: "nu-ilist-activeFormerTwoIndexed",
			draggingClass: "nu-ilist-dragging"
		},

		/*
		* loading, reset, dragging
		* */
		_status: 'loaded',




		/*
		 * 联系人信息列表容器
		 * */
		_$list: null,
		/*
		 * 索引条
		 * */
		_$index: null,
		/*
		 * 组件使用的数据
		 * */
		_data: null,
		/*
		 * 浮动的显示拼音对象
		 * */
		_$floatIndexed: null,
		/*
		 * 索引条拼音数组
		 * */
		_spellAry: null,
		/*
		 * 索引条的行高
		 * */
		_lineH:null,

		_constants:{
			floatIndexed: true // 浮动拼音指示
		},

		// 方法: 获取触控点坐标
		_page :  function (coord, event) {
			return (this._hasTouch? event.originalEvent.touches[0]: event)['page' + coord.toUpperCase()];
		},

		_dragIcon: function(distance){
			var cssY = this._scrollTop + distance;

			cssY = cssY > this._config.loadingH ? this._config.loadingH : cssY;

			//console.log('cssY', cssY);

			if(cssY !== this._iconPosY){
				this._iconPosY = cssY;
				this._$icon.css('top', cssY);
			}
			//else {
			//	console.log('不调整icon高度了')
			//}
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

			//console.log('rotateProps  ', rotateProps);

			$obj.css(rotateProps);
		},

		_setProps: function() {
			// 环境检测可用的css属性: 能否使用transition, 能否使用transform

			var bodyStyle = document.body.style;

			// 选择事件类型, 添加命名空间, 不会与其他插件冲突
			this._hasTouch = 'ontouchstart' in window;
			this._startEvent = this._hasTouch ? 'touchstart.draggableMenu': 'mousedown.draggableMenu';
			this._stopEvent = this._hasTouch ? 'touchend.draggableMenu': 'mouseup.draggableMenu';
			this._moveEvent = this._hasTouch ? 'touchmove.draggableMenu': 'mousemove.draggableMenu';

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

		//_initEvent: function(){
		//	// 初始化事件
		//	var _this = this, startY, moveY, ix, new_moveNum = 0, centerY, config = _this._config;
		//
		//	var $indexItem = this._$index.find('li'), len = $indexItem.length;
		//
		//	$indexItem.on(this._startEvent, this._startEventFunc);
		//},

		hide: function(){
			// 提供隐藏的方法
			this._getScrollTop();

			var _this = this;

			this._$icon
				.css(
				{
					top: 0
					- this._scrollTop + 'px'
				},
				this._config.resetDuration,
				function(){
					_this.removeClass('nu-refreshPull-loading');
				}
			);
		},

	}

});