define(function(require, exports, module){
	//require('jQuery');
	/**

	 /**
	 * @class Scroll
	 * @memberof Nuui
	 * @classdesc 列表组件<br/>
	 * 		实现了下拉刷新,上拉加载更多<br/>
	 * 		因为涉及到高度计算,该组件初始化时需要在onShow方法中进行<br/>
	 * 		以下列举4种场景<br/>
	 * 		1.对现有元素进行渲染,不需要上拉下拉加载,此时不需要送refreshData,loadMoreData,dataRenderer,enablePullDown,enablePullUp参数<br/>
	 * 		2.对数据进行渲染,需要上拉下拉加载,且数据直接展示第一页,此时传入refreshData,loadMoreData,dataRenderer,enablePullDown,enablePullUp,并调用triggerRefresh方法<br/>
	 * 		3.对数据进行渲染,需要上拉下拉加载,且暂不显示任何东西,等待使用者触发,此时传入上述5参数,并手工隐藏容器,然后在调用triggerRefresh前show容器<br/>
	 * 		4.对数据进行渲染,需要上拉加载,不需要下拉刷新,且数据直接展示第一页,此时传入refreshData,loadMoreData,dataRenderer,将enablePullUp设置为true,手工调用refresh
	 * 		由于iscroll本身只有topOffset参数,这里修改源代码增加了bottomOffset参数,如果使用新版本的iscroll需要做相应的源代码修改
	 * @param {element} el - 要渲染的元素,类型为原生的domElement,这个元素里面需要包含两层子元素,如<br/>
	 * 		&ltiv id="scroller">&ltdiv>&ltul>&lt/ul>&lt/div>&lt/div><br/>
	 * 		后续添加的子节点将添加在最里面的子元素里,需要通过containerSelector参数指定<br/>
	 * @param {object} options - 配置
	 * @param {func} containerSelector(string) - 选择器,根据该选择器在scroller中找到后续添加列表元素的根节点,如"ul"对应上文中的节点示例<br/>
	 * @param {func} options.dataRenderer(data) - 根据单条记录渲染单个元素的方法,返回jQuery对象<br/>
	 * @param {func} options.refreshData(render) - 刷新时调用的函数,可以通过ajax或其他方式加载新数据,<br/>
	 * 											并将数据列表送至render中,render方法会清空列表,并将新数据根据dataRenderer参数加载至容器中,<br/>
	 * 											如果没有数据,将展示"无数据"<br/>
	 * @param {func} options.loadMoreData(render) - 加载更多时调用的函数,可以通过ajax或其他方式加载新数据,<br/>
	 * 											并将数据列表送至render中,render方法会将新数据根据dataRenderer参数加入至容器中,<br/>
	 * 											如判断不会再有新数据,请在render前调用noMoreData()方法,容器将暂时禁用"上拉加载"功能,<br/>
	 * 											直至重新刷新数据</br>
	 * @param {func} options.enablePullDown - 是否激活下拉刷新功能,默认为false
	 * @param {func} options.enablePullUp - 是否激活上拉加载功能,默认为false
	 * @param {int} options.triggerOffset - 拉取超过提示框多少时触发"刷新"或"加载"事件,默认为10
	 * @example var scroller = new Scroll(view.$("#scroller")[0], {
	 * 	containerSelector:"ul",
	 * 	refreshData:function(render){
	 * 		App.request("a.do", {success:function(resp){
	 * 			render(resp.data.list);
	 * 		}});
	 * 	},
	 * 	loadMoreData:function(render){
	 * 		App.request("c.do", {success:function(resp){
	 * 			if(resp.data.list.length < 10){
	 * 				scroller.noMoreData();
	 * 			}
	 * 			render(resp.data.list);
	 * 		}});
	 * 	},
	 * 	enablePullDown:true,
	 * 	enablePullUp:true,
	 * 	dataRenderer:function(data){
	 * 		var el = $("<li>" + data.text + "</li>");
	 * 		el.on("tap", function(){
	 * 			console.log(data.text);
	 * 			return false;
	 * 		});
	 * 		return el;
	 * 	}
	 * });
	 * scroller.triggerRefresh();
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

	var RefreshPull = module.exports = function($wrapper, config){

		// 获取环境的设置
		this._setProps();

		// 基本设置
		this._basicSetting($wrapper, config);

		// 根据用户的设定来计算icon拖拽时的滚动速度等等
		this._calcRuns();

		 //生成icon内容
		this._renderIcon();

		// 给容器绑定开始事件
		this._$wrapper.on(this._startEvent, this._startEventFunc);

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
			},
			// 公开方法: 重新获取数据
			refreshData:null,
			// 公开方法: 加载更多数据
			loadMoreData:null,
			// 公开方法: 模板
			dataRenderer:null,
			// 选择向上拉向下拉的功能
			enablePullDown: false,
			enablePullUp: false
		},
		/*
		 * 状态分为loading, return, dragging
		 * */
		_status: 'loaded',

		_basicSetting: function($wrapper, config){
			// 绑定方法与本对象
			this._startEventFunc = $.proxy(this._startEventFunc, this);
			this._moveEventFunc = $.proxy(this._moveEventFunc, this);
			this._stopEventFunc = $.proxy(this._stopEventFunc, this);

			this._config = $.extend({}, this._defaultConfig, config);

			this._containerH = $wrapper.css({position: 'relative', overflow:'hidden'}).height();

			this._$container = $wrapper.find(this._config.containerSelector).wrap('<div>');

			this._$wrapper = this._$container.parent()
				.css({
					'overflow-y':'scroll', height: this._containerH
				});
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
			var iconWrapCss = {position: 'absolute', top: 0, 'z-index':999, opacity:0};
			this._$wrapper
				.before(
				this._$topIconWrap = $('<div class="nu-refreshPull">')
					.css(iconWrapCss)
					.append(
					this._$topIcon = this._config.renderer()
				)
			);

			if(this._config.enablePullUp) {
				this._$wrapper.after(
					this._$footIconWrap = $('<div class="nu-refreshPull">')
						.css(iconWrapCss)
						.append(
						this._$footIcon = this._config.renderer()
					)
				);
			}
			this._iconH = this._$topIconWrap.height();
		},

		_startEventFunc: function(e){
			//console.log('touch status = ', this._status);
			if(this._status !== 'loaded'){return}

			this._startY = this._page('y', e);

			// 重新获取尺寸信息
			this._scrollTop = this._$wrapper.scrollTop();
			this._contentH = this._$container.outerHeight(true);
			this._footerDragDistance = (this._contentH - this._containerH) - this._scrollTop;

			// 设icon的css过渡都为0
			if(this._config.enablePullDown) {
				this._setTransition(this._$topIconWrap, 0);}
			if(this._config.enablePullUp) {
				this._setTransition(this._$footIconWrap, 0);}

			// 绑定事件
			this._$wrapper.on(this._moveEvent, this._moveEventFunc);
			this._$wrapper.one(this._stopEvent, this._stopEventFunc);
		},

		_moveEventFunc: function(e){
			var touchY = this._page('y', e);
			var dragY = (touchY - this._startY) - this._scrollTop;
			var pullY = (this._startY - touchY) - this._footerDragDistance;// 最大_scrollTop减去当前的scrollTop值, 但滚动超过这个距离就开始事件!
			var iconRunY;//console.log(dragY, pullY);

			if(this._config.enablePullDown && dragY >= 0) {
				this._direct = 1;//console.log('顶端拖拽');
				iconRunY = dragY * 0.75; // 系数0.75是朋友圈的效果
			}
			if(this._config.enablePullUp && pullY >= 0) {
				this._direct = 2;//console.log('底部拖拽');
				iconRunY = pullY * 0.75;
			}

			if(!this._direct){return}

			this._selectFuncIcon(this._direct);

			this._status = 'dragging';//console.log('dragging');

			// 拖拽icon的时候要禁止默认事件: 滚动容器内容
			e.preventDefault();

			this._rotateDeg = iconRunY * this._dragDegPerY;

			this._rotateIcon(this._rotateDeg, this._$funcIcon);

			this._setIconPos(iconRunY, this._$funcIconWrap);
		},

		_selectFuncIcon: function(mode){
			// 选择当前操作的icon, mode = 1是选择顶部icon, 2是选择底部icon, 0是隐藏icon
			if(mode === 1){
				this._$funcIcon = this._$topIcon;
				this._$funcIconWrap = this._$topIconWrap.css('opacity', 1);
			} else if(mode === 2){
				this._$funcIcon = this._$footIcon;
				this._$funcIconWrap = this._$footIconWrap.css('opacity', 1);
			} else if(mode === 0){
				this._$topIconWrap.css('opacity', 0);
				this._$footIconWrap && this._$footIconWrap.css('opacity', 0);
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

				this._resetIcon({duration: backwardsDuration});
			}
		},

		_cleanEvent: function(){
			this._$wrapper.off(this._moveEvent + " " + this._stopEvent);
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
		_page:  function (coord, event) {
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
				cssY = this._containerH - distance;
			}else if($obj == this._$topIconWrap){
				cssY = distance - this._iconH;
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
		_resetIcon: function(options){
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

				_this._setIconPos(0, _this._$funcIconWrap);

				_this._selectFuncIcon(0);

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

		NO_DATA_HTML:"<div class='nu-sc-nodata'><div class='nu-sc-nodata-text'>无记录</div></div>",

		_noDataTipEl:null,

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
			this._$container.empty();
			this._items = [];
		},

		_appendItem:function(data){
			var item = this._config.dataRenderer(data);
			this._items.push(item);
			item.appendTo(this._$container);
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
				this._$container.append(
					this._noDataTipEl = $(this.NO_DATA_HTML).css("height", this._$wrapper.outerHeight(true))
				)
			}else{
				// 顺利获取数据的状态
				 if(this._noDataTipEl){
				 	this._noDataTipEl.hide();
				 }
			}
			this._resetIcon();
		},


		/**
		 * @desc 触发"下拉刷新"事件,一般用于首次加载数据
		 * @memberof Nuui.Scroll
		 * @func triggerRefresh
		 * @instance
		 */
		triggerRefresh:function(){
			this._selectFuncIcon(1);
			this._status = 'load';
			this._setIconRun();
			this._refreshData();
		}

	}

});