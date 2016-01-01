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

		// 生成内容
		this._renderIcon();

		this._initScrollTop = this._getScrollTop();

		this._setIconPos();

		this._$container.on(this._startEvent, this._startEventFunc);
	};

	RefreshPull.prototype = {

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
					this._config.comeDownDuration,
					function(){
						_this.removeClass('nu-refreshPull-loading');
					}
				);
		},

		load: function(){
			// 提供进入页面时候加载的动画滚动效果
			this._$icon
				.addClass('nu-refreshPull-loading')
				.css({top:
				this._config.loadingH + 'px'
				}, this._config.comeDownDuration);
		},


		loaded: function(){

			var _this = this;

			this._status = 'loaded';

			_this._$icon
				.removeClass('nu-refreshPull-loading')
				.addClass('nu-refreshPull-loaded');

			this._$icon
				.css(
				{'top': this._initScrollTop}
			);

			//setTimeout(function(){
			//	_this._status = null;
			//	_this._$icon.removeClass('nu-refreshPull-loaded')
			//}, 1200)
		},

		//_initEvent: function(){
		//	// 初始化事件
		//	var _this = this, startY, moveY, ix, new_moveNum = 0, centerY, config = _this._config;
		//
		//	var $indexItem = this._$index.find('li'), len = $indexItem.length;
		//
		//	$indexItem.on(this._startEvent, this._startEventFunc);
		//},

		_startEventFunc: function(e){
			if(this._status !== 'loaded'){return}
			this._$icon.removeClass('nu-refreshPull-loaded');

			this._startY = this._page('y', e);

			this._getScrollTop();

			this._$container.on(this._moveEvent, this._moveEventFunc);

			this._$container.one(this._stopEvent, this._stopEventFunc);
		},

		_moveEventFunc: function(e){

			e.preventDefault();

			this._$icon.css('transition', 'all 0s linear');

			var touchY = this._page('y', e);
			var dragY = touchY - this._startY;

			this._rotateIcon(dragY);

			this._dragIcon(dragY);
		},

		_stopEventFunc: function(e){

			this._$icon.css('transition', 'all 1s linear');

			this._cleanEvent();

			console.log('this._iconPosY', this._iconPosY);

			var _this = this;

			if(this._iconPosY == this._config.loadingH){
				this._status = 'load';
				this._$icon.addClass('nu-refreshPull-loading');

				setTimeout(function(){// 测试使用
					_this.loaded();
				}, 1000);

			} else {
				_this.loaded();
			}

		},

		_cleanEvent: function(){

			this._$container.off(this._moveEvent + " " + this._stopEvent);

		},

		// 默认值
		_defaultConfig : {
			loadingH: '100',
			comeDownDuration: 400,




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
			var cssY = this._scrollTop + (distance * 0.46);

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


		_rotateIcon: function(rotateZ, $obj) {
			// 方法setCSS: 即时位置调整
			$obj = $obj || this._$icon;

			$('.showText').text(rotateZ);

			var rotateProps = {};

			if (this._transformsEnabled !== false && this._cssTransitions !== false) {
				rotateZ = "rotateZ(" + rotateZ * 2 + "deg)";
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
		}

	}

});