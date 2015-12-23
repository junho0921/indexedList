﻿define(function(require, exports, module){

	// 优化历史:

	/**
	 * @class indexedList
	 * @memberof Nuui
	 * @classdesc 带索引的联系人列表<br/>
	 */

	/*
	* 分析事件:
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
	* 升级:
	* 1, 搜索功能
	* 2, 顶端浮动的指示拼音
	* 3, 点击联系人后, 有右侧滑动显示下一页效果
	* 4, 滑动索引条时, 效果:
	*   1, 围绕型 sony
	*   2, 浮动指示型 MX / 微信
	*   3,
	* 5, 跳转效果使用translate3D
	* 6, 有上下回弹效果
	*
	* 优化使用perspective
	*
	* 技术点有: sort函数的乱序与排序使用
	* */

	var IndexedList = module.exports = function($target, config, view){

		//this._windowH = $(window).height();

		this._hasTouch = !!("ontouchstart" in document);
		this._startEvent = this._hasTouch ? 'touchstart': 'mousedown';
		this._stopEvent = this._hasTouch ? 'touchend': 'mouseup';
		this._moveEvent = this._hasTouch ? 'touchmove': 'mousemove';

		this._scrollToSpell = $.proxy(this._scrollToSpell, this);
		
		this._$doc = view ? view.$el : $('body');

		this._config = $.extend({}, this._defaultConfig, config);

		this._$container = $target.css({
			'position': 'relative',
			'overflow': 'hidden',
			'overflow-y': 'scroll',
			'overflow-x': 'hidden',
			'height': '100vh'
		}).empty().append(
			this._$list = $('<ul>').css({
				'position': 'relative'
			})
		);

		// 计算索引
		this._calcIndexed();

		// 生成内容
		this._renderContent();

		// 获取尺寸数据作为事件的
		this._size();

		// 初始化事件
		this._initEvent();

	};

	IndexedList.prototype = {
		// 默认值
		_defaultConfig : {
			data: [], // 联系人信息
			floatIndexed: true, // 浮动拼音指示
			search: false, // 搜索功能
			indexContainer: null, //索引条的位置, 默认为view
			rowClass: 'nu-ilist-row',
			titleClass: 'nu-ilist-title',
			sectionClass: 'nu-ilist-section',
			indexedColClass: 'nu-ilist-indexedCol',
			floatIndexedClass: 'nu-ilist-floatIndexed',
			htmlIndexedName: "spell-indexed",
			animate: false // 滚动的动画效果
		},

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
		*
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

		},

		_each:function(ary, func){
			for(var i = 0; i < ary.length; i++){
				func(i, ary[i])
			}
		},

		_calcIndexed: function(){
			var by = function(name){
				return function(o, p){
					var a, b;
					if (typeof o === "object" && typeof p === "object" && o && p) {
						a = o[name];
						b = p[name];
						if (a === b) {
							return 0;
						}
						if (typeof a === typeof b) {
							//console.log(a , b, a < b);
							return a < b ? -1 : 1;
						}
						return typeof a < typeof b ? -1 : 1;
					}
					else {
						throw ("error");
					}
				}
			};

			// 重新排序data
			this._data = this._config.data.slice();

			// 测试使用的乱序
			this._data = this._shuffle(this._data);

			console.warn('');
			this._each(this._data, function(i, item){
				//console.log(i, item);
			});

			this._data.sort(by("spell"));
			console.warn('');

			this._each(this._data, function(i, item){
				//console.log(i, item);
			});
		},

		_renderContent: function(){
			// 生成列表
			var spellHead;
			var $ul;
			// 索引条字母的变量
			var spellList = [];

			for(var i = 0; i < this._data.length; i++){

				var data = this._data[i];
				var $node = $('<li>');
				var className = this._config.rowClass;
				var thisSpellHead = data.spell[0].toUpperCase();

				// 基本内容
				$node.addClass(className).html(
					'<span>' + data.spell + '</span>' +
					'<span>' + data.name + '</span>' +
					'<span>' + data.phone + '</span>'
				);

				// 拼音标题及容器
				if(thisSpellHead !== spellHead){
					// 把上一个字母渲染页面上
					if($ul){$ul.appendTo(this._$list);}
					spellHead = thisSpellHead;
					spellList.push(spellHead);

					$ul = $('<ul>')// 新建一个ul
						.addClass(this._config.sectionClass)
						.attr(this._config.htmlIndexedName, spellHead) //在section的标签上添加字母索引
						.append($('<li>').addClass(this._config.titleClass).html('<h2>' + spellHead + '</h2>')).append($node)
				}else{
					$node.appendTo($ul);
				}

				// 最后一个的话需要把$ul渲染到$list里
				if(i == this._data.length - 1){
					if($ul){$ul.appendTo(this._$list);}
				}

			}

			this._spellAry = spellList;

			// 生成索引条内容
			this._$index = $('<ul>').addClass(this._config.indexedColClass);
			for(var t = 0; t < spellList.length; t++){
				var letter = spellList[t];
				this._$index.append(
					$('<li>').html(
						'<h4>' + letter + '</h4>'
					)
				)
			}

			// 生成浮动索引拼音
			this._$floatIndexed = $('<div>').addClass(this._config.floatIndexedClass).html('<h2>' + spellHead + '</h2>');

			var $container;
			if(this._config.indexContainer) {
				$container = this._config.indexContainer;
			}else{
				$container = this._$doc;
				console.log('$container = this._$doc')
			}
			$container.append(this._$index).append(this._$floatIndexed.hide())
		},
		_size: function(){
			// 调整索引条的行距与字体大小
			var h = this._$index.height();
			var nums = this._$index.children().length;
			this._lineH = h / nums * 0.8;
			this._$index.css({'line-height': this._lineH + 'px', 'font-size': this._lineH * 0.8 + 'px', 'padding-top':h*0.1+'px'});
		},

		_initEvent: function(){

			var _this = this, startY, moveY, ix, new_ix, new_moveNum = 0, centerY;

			var $indexItem = this._$index.find('li');
			$indexItem.on(this._startEvent, function(e){

				startY = _this._page('y', e);

				ix = $(this).addClass('active').index();

				//centerY = $(this).position().top + _this._lineH/2;
				// 由于索引条行高由本组件锁定, 所以这里可以直接获取index值就计算出点击item的中心位置的高度:
				centerY = _this._lineH * (ix + 0.5);

				_this._scrollToIndex(ix);

				_this._addPreClass(ix);

				//if(_this._hasTouch){
					_this._$index.on(_this._moveEvent, function(e){
						e.preventDefault();
						moveY = _this._page('y', e);
						// 由垂直位移加上中心位置高度除以行高, 取最小整数, 就等于触控点所在的item视觉位置序号
						var new_ix = Math.floor(((moveY - startY) + centerY) / _this._lineH);
						// 优化: 模糊边缘
						if(new_moveNum !== new_ix){
							new_moveNum = new_ix;
							_this._scrollToIndex(new_ix);
							_this._addPreClass(new_ix);
							$indexItem.removeClass('active')[new_ix].className = 'active';
						}
					});

					_this._$index.one(_this._stopEvent, function(){
						console.log('解除绑定');
						_this._$index.off(_this._moveEvent);
						$indexItem.removeClass('active pre prepre');
						//clearTimeout(_this.timefunc);
						//_this.timefunc = setTimeout(function(){
						//	_this._$floatIndexed.fadeOut('slow');
						//},250);
					});
				//}
			});

		},

		_addPreClass: function(ix){
			this._$index.find('li').removeClass('pre prepre');
			var pre_ix = ix < 1 ? null : ix -1;
			var pre_pre_ix = pre_ix < 1 ? null : pre_ix - 1;
			if(pre_ix){this._$index.find('li').eq(pre_ix).addClass('pre')}
			if(pre_pre_ix){this._$index.find('li').eq(pre_pre_ix).addClass('prepre')}
		},

		/*
		* 滚动的方法
		* */
		_scrollToIndex: function(IndexNumbs){
			var _this = this;
			var indexSpell = this._spellAry[IndexNumbs];

			//console.log('indexSpell', indexSpell);

			var $t = this._$list.find('ul[' + this._config.htmlIndexedName + '=' + indexSpell + ']');
			var positionTop = $t.position().top;// 获取相对位置
			// 滚动
			this._$container.scrollTop(positionTop);
			// 显示浮动字母
			clearTimeout(this.timefunc);
			this._$floatIndexed.show().find('h2').text(indexSpell);
			this.timefunc = setTimeout(function(){
				_this._$floatIndexed.fadeOut('slow');
			},1500);

		},

		// 方法: 获取触控点坐标
		_page :  function (coord, event) {
			return (this._hasTouch? event.originalEvent.touches[0]: event)['page' + coord.toUpperCase()];
		},
		// 乱序方法
		_shuffle: function (inputArr) {
			var valArr = [], k;

			for (k in inputArr) { // Get key and value arrays
				//console.log(k, inputArr[k])
				if (inputArr.hasOwnProperty(k)) {
					valArr.push(inputArr[k]);
				}
			}
			valArr.sort(function () {
				return 0.5 - Math.random();
			});
//console.warn('');
//			for (var i in valArr) { // Get key and value arrays
//				console.log(i, valArr[i])
//			}

			return valArr;
		}
	}

});