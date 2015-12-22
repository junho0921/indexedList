define(function(require, exports, module){

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
	* 技术点有: sort函数的乱序与排序使用
	* */

	var indexedList = module.exports = function($target, config, view){

		var _this = this;

		var hasTouch = !!("ontouchstart" in document);
		console.log('hasTouch', hasTouch);

		this._startEvent = hasTouch ? 'touchstart.indexedList': 'mousedown.indexedList';
		this._stopEvent = hasTouch ? 'touchend.indexedList': 'mouseup.indexedList';
		this._moveEvent = hasTouch ? 'touchmove.indexedList': 'mousemove.indexedList';
		
		this._$doc = view ? view.$el : $('body');

		this._config = $.extend({}, this._defaultConfig, config);

		this._$list = $target.empty();

		// 计算索引
		this._calcIndexed();

		// 生成内容
		this._renderContent();

		// 初始化事件
		this._initEvent();

	};


	indexedList.prototype = {
		// 默认值
		_defaultConfig : {
			data: [], // 联系人信息
			floatIndexed: true, // 浮动拼音指示
			search: false, // 搜索功能
			rowClass: 'nu-ilist-row',
			sectionClass: 'nu-ilist-section',
			indexedColClass: 'nu-ilist-indexedCol',
			animate: false // 滚动的动画效果
		},

		/*
		 * 联系人信息列表容器
		 * */
		_$list: null,
		/*
		 * 索引条
		 * */
		_$indexed: null,

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
				console.log(i, item);
			});

			this._data.sort(by("spell"));
			console.warn('');

			this._each(this._data, function(i, item){
				console.log(i, item);
			});

			//console.log(this._data);

			// 生成索引条

			//要排序的数组：
		},

		_renderContent: function(){
			// 生成列表

			// 生成索引条
		},

		_initEvent: function(){
			var _this = this;

			function $name_bind(name, func){
				_this._$skb.on(_this._touchEvent, "." + _this._constants._modeLetter[name].class, func);
			}

			$name_bind('upper', function(){
				var imgSrc, changeCase;

				_this._upperCase = !_this._upperCase;

				if(_this._upperCase){
					changeCase = function(letter){ return letter.toUpperCase(); };
					imgSrc = "images/nuui-keyboard-capi1.png";
					//imgSrc = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAYAAAByDd+UAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyZpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuNS1jMDIxIDc5LjE1NTc3MiwgMjAxNC8wMS8xMy0xOTo0NDowMCAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTQgKFdpbmRvd3MpIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjRBNjVCQUJCRkEwODExRTRCRTJDRjg0QTk0MzcwN0I4IiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOjRBNjVCQUJDRkEwODExRTRCRTJDRjg0QTk0MzcwN0I4Ij4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6NEE2NUJBQjlGQTA4MTFFNEJFMkNGODRBOTQzNzA3QjgiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6NEE2NUJBQkFGQTA4MTFFNEJFMkNGODRBOTQzNzA3QjgiLz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz6dAx+GAAABAUlEQVR42mL08w9kIBGIAvFmKNsbiN+SopmJRMvYgHgFEJtD8SqoGE0sZATieUDshCTmBBVjpIWFbUAcjUU8GipHVQszgbgCj3wFVA1VLPQC4slEqAOp8aDUQl0gXgbEzERYyAxNULrkWigDxNuAmJ+EeOaH6pEh1UKCGsl1KBOOvLaOUNAQERXrsOVRbBbOQMtr5AKQGVMJWQhK3okM1AMp6NmJidwMTG6BwURuEUVukQiyUAtXBFMRwBKiFsjCZhLzGrkAZEczyMLPDPQDn0EWJkDDGRdWJ8FAdQJmJRBTeN8iwUKCapkY6AxGLRy1cPhY+J9Kaoi2cCeV1DAABBgAZEQk1ElC26cAAAAASUVORK5CYII=";
				}else{
					changeCase = function(letter){ return letter.toLowerCase(); };
					imgSrc = "images/nuui-keyboard-capi0.png";
					//imgSrc = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAYAAAByDd+UAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyZpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuNS1jMDIxIDc5LjE1NTc3MiwgMjAxNC8wMS8xMy0xOTo0NDowMCAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTQgKFdpbmRvd3MpIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjNBNDkzMjA3RkEwODExRTQ4OEU0OTA5QzcwREFGNUJFIiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOjNBNDkzMjA4RkEwODExRTQ4OEU0OTA5QzcwREFGNUJFIj4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6M0E0OTMyMDVGQTA4MTFFNDg4RTQ5MDlDNzBEQUY1QkUiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6M0E0OTMyMDZGQTA4MTFFNDg4RTQ5MDlDNzBEQUY1QkUiLz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz4OzkYWAAABgUlEQVR42mL08w9kIBGIAvFmKNsbiN+SopmJRMvYgHgFEJtD8SqoGE0sZATieUDshCTmBBVjpIWFbUAcjUU8GipHVQszgbgCif8MimGgAqqGKhZ6AfFkJP5HIPaA4o9I4pOhYhRZqAvEy4CYGcr/C8ThQHwZiqOgYgxQNSugesiyUAaItwExP5JYLhDvROJvg4rBAD9UTIZUC7Fp7ADi6VjUTofK4XMoXgtB+WodWtAsBeIqPKFRBVWDHBXrsOVRbBbOQMtr+4A4CYj/47HwP1TNPrQ8OpWQhaDknYjEByWMICD+RURq/gVVexlJLAUtO6FYiJ6Bn0CzxEcSCoePUD1PcBUYLHiKqLVAbIlm4D+oODIIxhJSIDX5aEXic1CQMwJrCy0g4xiuVIWjTEWPP2J9bwVyWTMJllECQHY0gyz8zEA/8BlkYQI0mHBhdRIMVCdgVgIxhfctEiwkqJaJgc5g1MKRZ+E/IsVwAhYyHPifHj78TyU1RFu4k0pqGAACDADFW0ujK5ksUAAAAABJRU5ErkJggg==";
				}

				// 变换字形
				_this._$skb.find('input.nu-skb-default').each(function(i, item){

					var letter = $(item).val();

					letter = changeCase(letter);

					$(item).val(letter);
				});

				// 改变图片
				$(this).find('img').attr('src', imgSrc);

			});

			$name_bind('del', function(){
				// 删除最后一个
				_this._spwd.pop();
				// 修改显示
				_this._displayVal = _this._displayVal.substring(0, (_this._displayVal.length - 1));
				_this._$list.text(_this._displayVal.length < 1 ? _this._config.placeholder : _this._displayVal);
				if(_this._displayVal.length < 1){
					_this._$list.height(_this._$list.height());
				}
			});

			$name_bind('确定', function(){
				_this.hide();
			});

			// 因为有了指定点击_$main才不退出, 所以不需要这个绑定
			//$name_bind('keyDown', function(){
			//	_this.hide();
			//});

			$name_bind('space', function(){
				if(!_this._config.codeMode){
					// 空格只有在非密码输入模式才有效
					_this._$list.text(_this._displayVal += ' ');
				}
			});

			$name_bind('abc', function(){
				_this._$main.empty().append(_this._$lettersContent);
				return false;
			});

			$name_bind('123', function(){
				_this._$main.empty().append(_this._$numbersContent);
				return false;
			});
		},

		_initKeyEvent: function(){
			var _this = this;

			this._$skb.on(this._touchEvent,'.nu-skb-default, .nu-skb-num-default', function(){

				var inputVal = $(this).attr('value');

				var value = _this._config.ct[inputVal];

				// 限制输入字数
				if(_this._displayVal.length >= _this._config.maxLength){return}

				if(_this._config.codeMode){
					// 密码模式
					_this._spwd.push(value);
					//console.log(_this._id, 'value = ', _this._spwd);
					// 展示
					if(_this._config.showLast){
						// 显示最后输入字符
						clearTimeout(_this._setTimeFunc);
						_this._$list.text(_this._displayVal + inputVal);
						_this._displayVal += _this._config.displayLetter;
						_this._setTimeFunc = setTimeout(function(){
							_this._$list.text(_this._displayVal);
						}, _this._config.displayTime);
					}else{
						_this._$list.text(_this._displayVal += _this._config.displayLetter);
					}
				} else {
					// 普通输入模式
					_this._$list.text(_this._displayVal += inputVal);
				}
			});
		},

		_calcCiphertext: function(){
			var o = {};
			var keys = this._config.key.split(",");
			var chars = this._constants._CHARS.substring(this._config.sequence) + this._constants._CHARS.substring(0, this._config.sequence);
			for(var i = 0 ; i < chars.length; i++){
				o[chars[i]] = keys[i];
			}
			this._config.ct = o;
		},

		//初始化父级DOM
		_initWrap: function(){
			this._$skb
				.append(
					"<div class=\"nu-skb-title\">" +
						"<span>" + this._config.title +"</span>" +
						"<span class='nu-skb-keyDown'>" +
							"<img src=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACIAAAANCAYAAADMvbwhAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyZpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuNS1jMDIxIDc5LjE1NTc3MiwgMjAxNC8wMS8xMy0xOTo0NDowMCAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTQgKFdpbmRvd3MpIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOkQ1MUE5RDAzMjA2MDExRTU4MkFDQUM3Mzk4N0YwMDA3IiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOkQ1MUE5RDA0MjA2MDExRTU4MkFDQUM3Mzk4N0YwMDA3Ij4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6RDUxQTlEMDEyMDYwMTFFNTgyQUNBQzczOTg3RjAwMDciIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6RDUxQTlEMDIyMDYwMTFFNTgyQUNBQzczOTg3RjAwMDciLz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz5ivY9/AAABY0lEQVR42ryUwUoCURSGT1eX+Qb5AkYk5KY21hNM0jtILSJfwI2GLkvaJL7BLLSd62iTbQNDVy2itgaBYpD+B/4Lw6XUGc0D36B3zvnPmTv/nQ3f9w9F5AKcgzdZb2yBG1AzuJTAMehyoNgaBoixV5e9yzpIFbyCBLgGHbD3j0Oo9iN7Jdi7ooO0wY5uD/hxEjdXOIBqXVE7w1419m4bJn2BAtgHzyAe2DpvBUN41CpQW3sc8L/2FuMUPHFHimAEkuAOtGisKGZsUSNJzSJ3pBNMNL8Uf4NLkAYPXFNDvYQws2tGoVaa2mO3wMwQ64EsOAWffMeLmNk1o9aeUav3V5GZ82QTUAcpbq/MMLMd1JpRWKO1t9SSqIPYeAc5cMLfrpm9wHdI730wN8f8uWFCmq8JtkGDT2jNbM044b0UcxcOE+EkDEAeHIF+YL3PtTxzQkV8iW/DPdjlcRSehmFUsakAAwA9RlZanXg0sAAAAABJRU5ErkJggg==\" >" +
						"</span>" +
					"</div>"
				)
				.append(
					this._$main = $('<div class="nu-skb-container">')
				)
				.appendTo(this._$doc);
		},

		// 乱序方法
		_shuffle: function (inputArr) {
			var valArr = [], k;

			for (k in inputArr) { // Get key and value arrays
				console.log(k, inputArr[k])
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
		},

		_createNumKey: function(){
			this._$numbersContent = $('<div>');

			var numberAry = this._constants._nums.slice();

			if(this._config.randomKeys){numberAry = this._shuffle(numberAry)}

			var key1, key2 = 'del';
			if(this._config.keyboardMode < 3){
				key1 = 'abc';
			} else if(this._config.keyboardMode == 3){
				key1 = '.';
			} else if(this._config.keyboardMode == 4){
				key1 = 'del';
				key2 = '确定';
			}
			numberAry.splice(9, 0, key1);
			numberAry.push(key2);

			// 分三行
			var cols = 3;

			for(var e = 0; e < numberAry.length; e++){

				var $row;

				if(e % cols == 0){
					// 新建一行
					$row = $('<div class="nu-skb-row">');
				}

				var $wrap = $('<span>').addClass('nu-skb-col-num');

				var content, $node, className;

				var modeLetter = this._constants._modeLetter[numberAry[e]];

				// 内容
				if(modeLetter){
					// nu-skb-mod按钮
					$node = modeLetter.content ? $("<div>").append(modeLetter.content) : $("<input type='button'>").attr('value', numberAry[e]);

					className = 'nu-skb-btn nu-skb-mod';

					className += " " + modeLetter.class;

				} else {
					// 普通按钮
					$node = $("<input type='button'>").attr('value', numberAry[e]);

					className = 'nu-skb-btn nu-skb-num-default';

					//className += " " + 'nu-skb-num-' + numberAry[e];
				}

				content = $node.attr({'class': className});

				$wrap.append(content).appendTo($row);

				// 数量满一行或最后一个就渲染到容器里
				if($row.children().length == cols || e == numberAry.length - 1){
					this._$numbersContent.append($row);
				}
			}

		},

		_createLetterKey: function(){

			this._$lettersContent = $('<div>');

			for(var line = 0; line < this._constants._letterline.length; line++ ){

				var lineKey = this._constants._letterline[line];

				var $row = $('<div class="nu-skb-row">');

				for(var e = 0; e < lineKey.length; e++){
					var $wrap = $('<span>').addClass('nu-skb-col');

					var content;

					var modeLetter = this._constants._modeLetter[lineKey[e]];

					var $node, className;

					// 内容
					if(modeLetter){
						// nu-skb-mod按钮
						$node = modeLetter.content ? $("<div>").append(modeLetter.content) : $("<input type='button'>").attr('value', lineKey[e]);

						className = 'nu-skb-btn nu-skb-mod';

						className += " " + modeLetter.class;

					} else {
						// nu-skb-default普通按钮
						$node = $("<input type='button'>").attr('value', lineKey[e]);

						className = 'nu-skb-btn ' + ((lineKey[e].length < 1) ? 'nu-skb-space' : 'nu-skb-default');

						//className += " " + (lineKey[e].length < 1)?'nu-skb-space':('nu-skb-' + lineKey[e]);
					}

					content = $node.attr({'class': className});

					$wrap.append(content).appendTo($row);
				}
				this._$lettersContent.append($row);
			}

		},

		/*
		* 隐藏键盘
		* */
		hide:function(){
			this._$skb.css({'bottom': '-' + this._$skb.height() + 'px'});
		},

		/*
		* 获取密码键盘的ID
		* */
		getId:function(){
			return this._id;
		},

		/*
		* 获取报文的长度
		* */
		getLength:function(){
			return this._spwd.length;
		},

		/*
		 * 获取报文
		 * */
		getEncrypt: function(){
			return this._spwd.join(this._config.joinLetter);
		}
	}

});