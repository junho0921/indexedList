﻿define(function(require, exports, module){
	//require('jQuery');
	/**
	 * @class refreshPull
	 * @memberof Nuui
	 * @classdesc 文本流基础的拖拉刷新<br/>
	 * @param {$} $target - 容器对象
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

	 2, 以Nuui测试为基础的优化,
	 优化点:
	 2-1, icon的上下移动以iconWrap改变translate3D的y轴值, 原本上下移动是使用css的y坐标, 但性能差一点的手机又闪屏问题;

	 2-2, js控制icon的动画设定, 方法是_setIconAnimation, 这就不需要css写太多兼容字眼, 有效减少代码!

	 2-3, 回滚icon动画只使用一个就够了, 但多计算一下回滚次数与时间值, 为了减少代码
	*
	* 待优化:
	* 1, 现在使用的是transform, 但没有降级方案
	* 2, 问毅明使用requestAnimationFrames?
	* */

	var RefreshPull = module.exports = function($target, config){

		// 获取环境的设置
		this._setProps();

		// 基本设置
		this._basicSetting($target, config);

		// 根据用户的设定来计算icon拖拽时的滚动速度等等
		this._calcRuns();

		 //生成icon内容
		this._renderIcon();

		// 设icon位置
		this._setInitialPos();// 应该在加载模板后才进行初始位置

		// 给容器绑定开始事件
		this._$container.on(this._startEvent, this._startEventFunc);

		return this;
	};

	RefreshPull.prototype = {

		// 默认值
		_defaultConfig : {
			// icon滚出的最长距离
			loadingH: 200,
			// 收回icon的回滚次数
			dragRuns: 2,
			// 收回icon的回滚时间
			resetDuration: 1000,
			// icon内容
			renderer: function(){
				return $('<img src="./img/iconfont-loading.png">');
			}
		},
		/*
		 * 状态分为loading, return, dragging
		 * */
		_status: 'loaded',

		_basicSetting: function($target, config){
			// 绑定方法与本对象
			this._startEventFunc = $.proxy(this._startEventFunc, this);
			this._moveEventFunc = $.proxy(this._moveEventFunc, this);
			this._stopEventFunc = $.proxy(this._stopEventFunc, this);
			this.hide = $.proxy(this.hide, this);

			this._config = $.extend({}, this._defaultConfig, config);

			this._$container = $target.css({position: 'relative', 'overflow-y':'scroll'});
			
			this._wrapper = this._$container[0];

			this._containerH = this._$container.height();
			
			this._$content = this._$container.find(this._config.containerSelector);
		},

		_calcRuns: function(){
			// icon滚一圈所用时间
			this._circleDuration = this._config.resetDuration / this._config.dragRuns;

			// icon每滚1deg所变化的高度
			this._dragDegPerY = (this._config.dragRuns * 360) / this._config.loadingH;

			// icon每滚1deg所过渡的时间
			this._resetDegPerTime = 360 / this._circleDuration;
		},

		_renderIcon: function(){
			var iconCss = {position: 'absolute', top: 0, 'z-index':999, opacity:0};
			this._$container
				.append(
				this._$topIconWrap = $('<div class="nu-refreshPull">')
					.css(iconCss)
					.append(
					this._$topIcon = this._config.renderer()
				)
			)
				.append(
				this._$footIconWrap = $('<div class="nu-refreshPull">')
					.css(iconCss)
					.append(
					this._$footIcon = this._config.renderer()
				)
			);
		},

		_setInitialPos: function(){
			// 设icon的位置在容器的顶部隐藏
			this._initTopIconPos = this._$container.scrollTop() - this._$topIcon.height();
			this._setIconPos(0, this._$topIconWrap);

			this._initfootIconPos = this._$content.outerHeight(true) + this._$topIcon.height();
			this._setIconPos(0, this._$footIconWrap);
		},
		
		_startEventFunc: function(e){
			//console.log('touch status = ', this._status);
			if(this._status !== 'loaded'){return}

			this._startY = this._page('y', e);

			// 重新获取尺寸信息
			this._scrollTop = this._$container.scrollTop();
			this._contentH = this._$content.outerHeight(true);
			this._footerDragDistance = (this._contentH - this._containerH) - this._scrollTop;

			// 设icon的css过渡都为0
			this._setTransition(this._$topIconWrap, 0);
			this._setTransition(this._$footIconWrap, 0);

			// 绑定事件
			this._$container.on(this._moveEvent, this._moveEventFunc);
			this._$container.one(this._stopEvent, this._stopEventFunc);
		},

		_moveEventFunc: function(e){
			var touchY = this._page('y', e);
			var dragY = (touchY - this._startY) - this._scrollTop;
			var pullY = (this._startY - touchY) - this._footerDragDistance;// 最大_scrollTop减去当前的scrollTop值, 但滚动超过这个距离就开始事件!
			var iconRunY;//console.log(dragY, pullY);

			if(dragY >= 0) {
				this._direct = 1;//console.log('顶端拖拽');
				iconRunY = dragY * 0.75; // 系数0.75是朋友圈的效果
			}
			if(pullY >= 0) {
				this._direct = 2;//console.log('底部拖拽');
				iconRunY = pullY * 0.75;
			}

			if(!this._direct){return}

			this._selectIcon(this._direct);

			this._status = 'dragging';//console.log('dragging');

			// 拖拽icon的时候要禁止默认事件: 滚动容器内容
			e.preventDefault();

			this._rotateDeg = iconRunY * this._dragDegPerY;

			this._rotateIcon(this._rotateDeg, this._$funcIcon);

			this._setIconPos(iconRunY, this._$funcIconWrap);
		},

		_selectIcon: function(mode){
			// 选择当前操作的icon, mode = 1是选择顶部icon, 2是选择底部icon, 0是隐藏icon
			if(mode === 1){
				this._$funcIcon = this._$topIcon;
				this._$funcIconWrap = this._$topIconWrap.css('opacity', 1);
			} else if(mode === 2){
				this._$funcIcon = this._$footIcon;
				this._$funcIconWrap = this._$footIconWrap.css('opacity', 1);
			} else if(mode === 0){
				this._$footIconWrap.css('opacity', 0);
				this._$funcIcon = null;
				this._$funcIconWrap = null;
			}
		},

		_stopEventFunc: function(){

			var _this = this, backwardsDuration;

			this._cleanEvent();

			// 没有拖拽icon的话不用执行以下方法
			if(this._status !== 'dragging'){return}

			if(this._toLoad){

				/*2 混合模式: 先使用animate方法来调整为0deg, 后使用CSS3的animation的动画循环效果*/
				var backwardsDeg = this._rotateDeg % 360;

				backwardsDuration = backwardsDeg / this. _resetDegPerTime;

				this._rotateIcon(backwardsDeg, _this._$funcIcon);

				$({"deg": backwardsDeg})
					.animate({"deg": 0}, {
						duration: backwardsDuration,
						easing: 'linear',
						step: function(now) {
							_this._rotateIcon(now, _this._$funcIcon);
						},
						complete: function() {
							_this._status = 'load';
							_this._setIconRun();
							if(_this._direct === 1){
								_this._refreshData();
							} else if(_this._direct === 2){
								_this._loadMoreData();
							}
						}
					});

			} else {
				// 没有拉到最低, 中途释放拖拽的话添加特别的格式, 修改动画时间
				this._status = 'return';

				backwardsDuration = this._rotateDeg / this._resetDegPerTime;

				// 由于使用loadingAnimation, icon回滚旋转多了360度, 所以需要处理一下时间与次数
				var iterationCount = this._rotateDeg / (this._rotateDeg + 360);

				this._setIconAnimation(this._$funcIcon, 'loadingAnimation', iterationCount, backwardsDuration + this._circleDuration);

				this.hide({duration: backwardsDuration});
			}
		},

		_cleanEvent: function(){

			this._$container.off(this._moveEvent + " " + this._stopEvent);

		},

		_setIconAnimation: function($obj, name, iterationCount, backwardsDuration){
			var props = {};
			props[this._animationType + '-name'] = name;
			props[this._animationType + '-iteration-count'] = iterationCount;
			props[this._animationType + '-duration'] = (backwardsDuration / 1000).toFixed(2) + 's';
			props[this._animationType + '-timing-function'] = 'linear';

			$obj.css(props);
		},

		// 方法: 获取触控点坐标
		_page :  function (coord, event) {
			return (this._hasTouch? event.originalEvent.touches[0]: event)['page' + coord.toUpperCase()];
		},

		_setIconPos: function(distance, $obj){
			// 初始化定位, 拖拽定位
			// 区别在于有没有_direct属性 // 因为_setIconPos运用的场景比较多, 所以对象$obj不能默认是this._$funcIconWrap
			var cssY, posProps = {};

			if(distance >= this._config.loadingH){
				distance = this._config.loadingH;
				this._toLoad = true;
			} else {
				this._toLoad = false;
			}

			// 这里的判断提供了本方法可以传入第一参数是拖拽距离就可以, 本判断可以处理对应icon的实际变化位置, 方便使用了
			if($obj == this._$footIconWrap){
				cssY = this._initfootIconPos - distance
			}else if($obj == this._$topIconWrap){
				cssY = distance + this._initTopIconPos;
			} else {return}

			if(cssY !== this._iconPosY){
				this._iconPosY = cssY;//console.log(cssY);

				posProps[this._animType] = "translate3D(0, " + cssY + "px, 0)";

				$obj.css(posProps);
			}
		},

		_rotateIcon: function(rotateDeg, $obj) {
			// 拖拽旋转icon
			var rotateProps = {};
			rotateProps[this._animType] = "rotateZ(" + rotateDeg + "deg)";
			$obj.css(rotateProps);
		},

		_setTransition: function($obj, duration) {
			var transition = {};

			transition[this._transitionType] = this._transformType + ' ' + duration + 'ms linear';

			$obj.css(transition);
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

		_setIconRun: function(){
			// icon的滚动状态

			this._setIconPos(this._config.loadingH, this._$funcIconWrap);

			this._setIconAnimation(this._$funcIcon, 'loadingAnimation', 'infinite', this._circleDuration);
		},

		/*
		 * 加载完毕的退出方法
		 * */
		hide: function(options){
			var _this = this,
				duration = options && options.duration;

			duration = duration || this._config.resetDuration;

			this._setTransition(_this._$funcIconWrap, duration);

			this._setIconPos(0, this._$funcIconWrap);

			setTimeout(function(){

				_this._setIconAnimation(_this._$funcIcon,'', '', 0);

				_this._rotateIcon(0, _this._$funcIcon);

				_this._status = 'loaded';

				_this._direct = null;

				_this._selectIcon(0);

				_this._toLoad = false;

				if(options && options.callback)options.callback();
			}, duration);
		},

		/* ---------------------------------------------------------------------------------------*/
		/* ---------------------------------------------------------------------------------------*/
		/* ---------------------------------------------------------------------------------------*/
		/* ---------------------------------------------------------------------------------------*/
		/* ---------------------------------------------------------------------------------------*/
		/* ---------------------------------------------------------------------------------------*/
		/* ---------------------------------------------------------------------------------------*/
		/* ---------------------------------------------------------------------------------------*/
		/* ---------------------------------------------------------------------------------------*/

		PULL_DOWN_HTML:"<div class='nu-sc-down'><div class='nu-sc-down-icon'>&nbsp;</div><div class='nu-sc-down-text'></div></div>",

		PULL_UP_HTML:"<div class='nu-sc-up'><div class='nu-sc-up-icon'>&nbsp;</div><div class='nu-sc-up-text'></div></div>",

		NO_DATA_HTML:"<div class='nu-sc-nodata'><div class='nu-sc-nodata-text'>无记录</div></div>",

		STATUS_REFRESH:1,
		STATUS_LOADMORE:2,

		_defaultOptions:{
			triggerOffset:20,
			refreshData:null,
			loadMoreData:null,
			dataRenderer:null,
			enablePullDown:false, //还没有扩展此功能
			enablePullUp:false//还没有扩展此功能
		},

		_noDataTipEl:null,

		/*没有使用上的*/
		//_onScrollMove:function(e){
		//
		//	if(this._threshold){
		//		clearTimeout(this._timeout);
		//		var bcr = this._wrapper.getBoundingClientRect();
		//		var top = bcr.top;
		//		var bottom = bcr.bottom;
		//
		//		if((this.pointY <= top || this.pointY >= bottom)){
		//			// 如果拉动超出边界且需要处理的话,直接触发touchend
		//			this._onOutOfThreshold(e);
		//			return;
		//		}
		//	}
		//
		//	//jun : 参考以下方法的逻辑, 已经免除提示语, 关键是状态判断
		//
		//	// 向下拉超出边界
		//	if(this._config.enablePullDown && this.y > - this._config.topOffset){
		//		if(this.y > this._config.triggerOffset){
		//			this._renderReleasePullDown(e);
		//		}else if(this._status == this.STATUS_REFRESH){
		//			this._renderPullDown(e);
		//		}
		//		return;
		//	}
		//	// 向上拉超出边界
		//	if(this._config.enablePullUp && this.y < Math.min(this.maxScrollY, this.minScrollY) && this._hasMoreData){
		//		// min和max根据容器和内容高度一起加减计算得出
		//		// 有可能内容不会超过容器高度,所以二者取一
		//		if(this.y < Math.min(this.maxScrollY, this.minScrollY) - this._config.bottomOffset - this._config.triggerOffset){
		//			this._renderReleasePullUp(e);
		//		}else if(this._status == this.STATUS_LOADMORE){
		//			this._renderPullUp(e);
		//		}
		//		return;
		//	}
		//},

		//_onOutOfThreshold:function(e){
		//	// 仿照本来的行为,延时执行scrollEnd
		//	this._resetPos(400);
		//	var that = this;
		//	this._timeout = setTimeout(function(){
		//		that._onScrollEnd(e);
		//	}, 400);
		//},

		//_onScrollEnd:function(e){
		//
		//	if(this._status == this.STATUS_REFRESH){
		//		this._renderPullDown(e);
		//		this._refreshData();
		//	}else if(this._status == this.STATUS_LOADMORE){
		//		this._renderPullUp(e);
		//		this._loadMoreData();
		//	}
		//},

		//_renderPullDown:function(e){
		//	this._status = null;
		//},
		//
		//_renderReleasePullDown:function(e){
		//	this._status = this.STATUS_REFRESH;
		//},
		//
		//_renderPullUp:function(e){
		//	this._status = null;
		//},
		//
		//_renderReleasePullUp:function(e){
		//	this._status = this.STATUS_LOADMORE;
		//},

		_refreshData:function(){
			this._config.refreshData($.proxy(this._refreshRender, this));
		},

		_loadMoreData:function(){
			this._config.loadMoreData($.proxy(this._loadMoreRender, this));
		},

		_refreshRender:function(datas){
			this._clearItems();
			this._appendItems(datas);
		},

		_loadMoreRender:function(datas){
			this._appendItems(datas);
		},

		_clearItems:function(){
			this._$content.empty();
			this._items = [];
		},

		_appendItem:function(data){
			var item = this._config.dataRenderer(data);
			this._items.push(item);
			item.appendTo(this._$content);
		},

		_appendItems:function(datas){
			for(var i = 0; i < datas.length; i++){
				this._appendItem(datas[i]);
			}
			this._refresh();
		},

		_refresh:function(){
			// 检测提示语效果
			if(this._items.length == 0){
				if(!this._noDataTipEl){
					this._noDataTipEl = $(this.NO_DATA_HTML);
					$(this._wrapper).after(this._noDataTipEl);
				}
				this._noDataTipEl.css("height", $(this._wrapper).outerHeight(true));
				this._noDataTipEl.show();
				$(this._wrapper).hide();
			}else{
				// 顺利获取数据的状态
				// if(this._noDataTipEl){
				// 	this._noDataTipEl.hide();
				// }
				// $(this._wrapper).show();
				this.hide({callback: $.proxy(this._setInitialPos, this)});
			}
		},


		/**
		 * @desc 触发"下拉刷新"事件,一般用于首次加载数据
		 * @memberof Nuui.Scroll
		 * @func triggerRefresh
		 * @instance
		 */
		triggerRefresh:function(){
			this._status = 'load';
			this._setIconRun();
			this._refreshData();
		}

	}

});