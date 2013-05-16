pb = {
	settingsUrl: 'data/settings.xml',
	settings: null,

	initializeTransitions: function (activeMenuItemId) {
		$('#' + activeMenuItemId).addClass('active');
		var body = $("body");
		body.css("display", "none");
		body.fadeIn(500, function () {
			body.css("display", "block");
		});
		$("a.transition").click($.proxy(this.onLinkClick, this));
	},

	redirectPage: function () {
		window.location = this.linkLocation;
	},

	onLinkClick: function (event, ff) {
		event.preventDefault();
		if (!$(event.target).hasClass('active')) {
			this.linkLocation = event.target.href;
			$("body").fadeOut(500, $.proxy(this.redirectPage, this));
		}
	},

	applyTemplate: function (template, data) {
		var html = template;
		var reg = /\{\w*\}/g;
		var arr = html.match(reg);
		if (arr) {
			for (var i = 0; i < arr.length; i++) {
				var tag = arr[i];
				var property = tag.substr(1, tag.length - 2);
				html = html.replace(tag, data[property] || '');
			}
		}
		return html;
	},

	format: function (text) {
		var formatted = text;
		for (var i = 1; i < arguments.length; i++) {
			var regexp = new RegExp('\\{' + (i - 1) + '\\}', 'gi');
			formatted = formatted.replace(regexp, arguments[i]);
		}
		return formatted;
	},

	getFloat: function (str) {
		if (!str) {
			return null;
		}
		return parseFloat(str.replace(',', '.'));
	},

	toStr: function (num) {
		return num.toString().replace('.', ',');
	},

	concatStrings: function () {
		var args = Array.prototype.slice.call(arguments);
		return args.join("");
	},

	initializeOrderController: function (config) {
		this.orderController = new pb.OrderController(config);
	},

	updateWorkTime: function (isOrderTime) {
		this.workTimeController = new pb.WorkTimeController(isOrderTime);
	},

	getDateByTime: function (time) {
		time = time.split(':');
		var date = new Date();
		date.setHours(time[0]);
		date.setMinutes(time[1]);
		return date;
	},

	getWorkStartDate: function () {
		return this.getDateByTime(this.settings.WorkStartTime);
	},

	getWorkEndDate: function () {
		return this.getDateByTime(this.settings.WorkEndTime);
	},

	getOrderStartDate: function () {
		return this.getWorkStartDate();
	},

	getOrderEndDate: function () {
		var workEndDate = this.getWorkEndDate();
		workEndDate.setMinutes(workEndDate.getMinutes() - 15);
		return workEndDate
	}
};

pb.OrderController = Base.extend({
	defaults: {
		productsUrl: 'data/products.xml',
		getDataUrl: 'http://91.200.201.188:81/data/products.xml',
		postDataUrl: 'http://91.200.201.188:81/BeerShopService.asmx/AddOrder'
	},

	postSuccessMessage: "Ваш заказ зарегистрирован и будет доставлен в ближайшие 30 минут",
	errorBeerQuantityMessage: "Заказ должен содержать не мение {0} л. пива, а в Вашем заказе {1} л.",
	isNotWorkTimeMessage: "Прием заказов осуществляется с {0} до {1}. Сейчас заказы не принимаются",
	settingsErrorMessage: "Ошибка получения файла с настройками. Повторите попытку позже",
	productsErrorMessage: "Ошибка соединения с магазином. Повторите попытку позже",
	products: null,
	beerTable: null,
	snacksTable: null,
	addressInput: null,
	addressError: null,
	phoneError: null,
	phoneInput: null,
	acceptDelivery: null,
	acceptDeliveryError: null,
	descriptionInput: null,
	message: null,
	productPicture: null,
	order: null,

	constructor: function (config) {
		this.config = $.extend({}, this.defaults, config);
		this.initializeTabs();
		this.getSettings();
		this.defineProperties();
		this.initializeEvents();
		this.initializeMessagePanel();
		this.initializeLoader();
		this.order = new pb.Order();
	},

	initializeTabs: function () {
		$("ul.product-tabs-header").tabs("div.product-tabs-content > div", {
			effect: 'fade'
		});
		var tabsApi = $('ul.product-tabs-header').data('tabs');
		tabsApi.onClick($.proxy(this.onTabsChange, this));
	},

	initializeEvents: function () {
		$('.order-beer-bottles').live('click', $.proxy(this.onAddButtonClick, this));
		$('.order-beer-information').live('click', $.proxy(this.onDescriptionIconClick, this))
		$('#sendButton').click($.proxy(this.onSendButtonClick, this));
		this.addressInput.focusin($.proxy(this.hideAllErrorMessage, this));
		this.phoneInput.focusin($.proxy(this.hideAllErrorMessage, this));
		this.acceptDelivery.click($.proxy(this.hideAllErrorMessage, this));
		this.descriptionInput.focusin($.proxy(this.hideAllErrorMessage, this));
	},

	defineProperties: function () {
		this.beersTable = $('#beersTable');
		this.snacksTable = $('#snacksTable');
		this.addressInput = $('#edtAddress');
		this.addressError = $('.form-error.address');
		this.phoneInput = $('#edtPhone');
		this.phoneError = $('.form-error.phone');
		this.acceptDelivery = $('#acceptDeliveryCondition');
		this.acceptDeliveryError = $('.form-error.rules');
		this.descriptionInput = $('#edtDescription');
		this.productPicture = $('.product-picture');
	},

	initializeMessagePanel: function () {
		var messageTarget = $('#overlayTarget')
		var mask = {
			color: '#4a4a45',
			loadSpeed: 200,
			opacity: 0.9
		};
		messageTarget.overlay({
			mask: mask,
			top: 'center',
			closeOnClick: false,
			onLoad: function () {
				var overlay = this.getOverlay();
				var left = ($(window).width() - overlay.width()) / 2;
				var top = ($(window).height() - overlay.height()) / 2;
				overlay.css({
					left: left + 'px',
					top: top + 'px'
				});
			}
		});
		this.messagePanel = messageTarget.data("overlay");
	},

	initializeLoader: function () {
		var loaderTarget = $('#loaderTarget')
		var mask = {
			color: '#4a4a45',
			loadSpeed: 200,
			opacity: 0.9
		};
		loaderTarget.overlay({
			mask: mask,
			top: 'center',
			closeOnClick: false,
			closeOnEsc: false,
			onLoad: function () {
				var overlay = this.getOverlay();
				var left = ($(window).width() - overlay.width()) / 2;
				var top = ($(window).height() - overlay.height()) / 2;
				overlay.css({
					left: left + 'px',
					top: top + 'px'
				});
			}

		});
		this.loader = loaderTarget.data("overlay");
	},

	getSettings: function () {
		$.ajax({
			url: pb.settingsUrl,
			cache: false,
			success: $.proxy(this.onGetSettings, this),
			error: $.proxy(this.onGetSettingsError, this)
		});
	},

	onGetSettings: function (data, textStatus, jqXHR) {
		pb.settings = {};
		var items = $(data).find('item');
		for (var i = 0; i < items.length; i++) {
			var item = items[i];
			var name = item.getAttribute('Code');
			var value = item.getAttribute('Value');
			pb.settings[name] = value;
		}
		var url = this.config.getDataUrl;
		if (!this.isWorkTime()) {
			url = this.config.productsUrl;
		}
		this.showLoader("Соеднинение с магазином ...");
		$.support.cors = true;
		$.ajax({
			url: url,
			crossDomain: true,
			cache: false,
			success: $.proxy(this.onGetProductsXml, this),
			error: $.proxy(this.onGetProductsError, this)
		});
	},

	isWorkTime: function () {
		var start = pb.getWorkStartDate();
		var end = pb.getOrderEndDate();
		var now = new Date();
		return (now >= start) && (now < end);
	},

	showNotWorkTimeMessage: function () {
		var startTime = pb.getOrderStartDate();
		var minutes = startTime.getMinutes();
		if (minutes < 10) {
			minutes = '0' + minutes;
		}
		var startTime = startTime.getHours() + ':' + minutes;
		var endTime = pb.getOrderEndDate();
		var minutes = endTime.getMinutes();
		if (minutes < 10) {
			minutes = '0' + minutes;
		}
		var endTime = endTime.getHours() + ':' + minutes;
		var notWorkTimeMessage = pb.format(this.isNotWorkTimeMessage, startTime, endTime);
		this.showInformationMessage(notWorkTimeMessage);
	},

	onGetSettingsError: function (jqXHR, textStatus, errorThrown) {
		this.showWarningMessage(this.settingsErrorMessage);
	},

	onGetProductsXml: function (data, textStatus, jqXHR) {
		this.hideLoader();
		this.products = [];
		var items = $(data).find('item');
		for (var i = 0; i < items.length; i++) {
			var properties = items[i].attributes;
			var product = {}
			for (var j = 0; j < properties.length; j++) {
				var property = properties[j];
				product[property.name] = property.value;
			}
			this.products.push(product);
		}
		this.products.sort(this.sortProductsByName);
		this.showProducts();
		if (this.isWorkTime()) {
			if (pb.settings.SiteBroadcastMessage) {
				setTimeout($.proxy(this.showInformationMessage, this, pb.settings.SiteBroadcastMessage), 500);
			}
		} else {
			setTimeout($.proxy(this.showNotWorkTimeMessage, this), 500);
		}
	},

	onGetProductsError: function (jqXHR, textStatus, errorThrown) {
		this.hideLoader();
		setTimeout($.proxy(this.showWarningMessage, this, this.productsErrorMessage), 500);
	},

	sortProductsByName: function (a, b) {
		return (a.Name > b.Name) ? 1 : -1;
	},

	showProducts: function () {
		for (var i = 0; i < this.products.length; i++) {
			var product = this.products[i];
			if (product.TypeName == pb.settings.BeerTypeProduct) {
				this.showBeer(product);
			} else {
				this.showSnack(product);
			}
		}
	},

	showBeer: function (product) {
		var template = pb.concatStrings(
			'<tr>',
				'<td class="order-product-logo line" rowspan="2"><img src="{LogoFileName}" alt="[логотип]" /></td>',
				'<td class="order-beer-text">',
					'<div class="order-beer-info-item order-beer-name">{Name} {BeerType}</div>',
					'<div class="order-beer-price">Цена: <span class = "{priceCls}" title="{hotPriceTitle}">{Price} грн./{UnitName}</span></div>',
					'<div class="order-beer-info-item">Производитель: {AccountCityName}</div>',
					'<div class="order-beer-info-item">Алкоголь: {Alcohol}%</div>',
					'<div class="order-beer-info-item">Плотность: {Density}%</div>',
				'</td>',
				'<td class="order-beer-bottles">{buttons}</td>',
			'</tr>',
			'<tr>',
				'<td class="line" colspan="2">',
					'<div class="order-beer-information">Описание</div>',
					'<div class="order-beer-description">{Information}</div>',
				'</td>',
			'</tr>'
		);
		product.Information = product.Information || "Описание отсутствует";
		if (product.BeerType) {
			product.BeerType = "(" + product.BeerType + ")";
		}
		if (product.IsStockPrice == "1") {
			product.priceCls = "hot-price";
			product.hotPriceTitle = "Акционная цена"
		}
		product.Alcohol = product.Alcohol || "0";
		product.Density = product.Density || "0";
		product.Price = pb.toStr(pb.getFloat(product.Price).toFixed(2));
		product.buttons = this.getAddButtons(product.ID);
		var html = pb.applyTemplate(template, product);
		this.beersTable.append(html);
	},

	getAddButtons: function (productID) {
		var template = '<input type="button" value="Добавить {0}л." class="button" productId={1} quantity="{2}" />';
		var bottles = pb.settings.bottles;
		var bottles = bottles.split(';');
		var buttons = '';
		for (var i = 0; i < bottles.length; i++) {
			var volume = bottles[i];
			buttons += pb.format(template, volume, productID, pb.getFloat(volume));
		}
		return buttons
	},

	showSnack: function (product) {
		var template = pb.concatStrings(
			'<tr class="line">',
				'<td class="order-beer-text line"><div class="order-beer-name">{Name}</div></td>',
				'<td class="order-beer-price line">{Price} грн./{UnitName}</td>',
				'<td class="order-beer-bottles line">',
					'<input type="button" value="Добавить" class="button" productId={ID} quantity="1"/>',
				'</td>',
			'</tr>'
		);
		product.Price = pb.toStr(pb.getFloat(product.Price).toFixed(2));
		var html = pb.applyTemplate(template, product);
		this.snacksTable.append(html);
	},

	getProductById: function (id) {
		var product = null;
		for (var i = 0; i < this.products.length; i++) {
			if (this.products[i].ID == id) {
				var product = this.products[i];
				break;
			}
		}
		return product;
	},

	onAddButtonClick: function (e) {
		var button = e.target;
		var productId = button.getAttribute('productId');
		var product = this.getProductById(productId);
		var quantity = parseFloat(button.getAttribute('quantity'));
		this.order.addProduct(product, quantity);
	},

	onSendButtonClick: function () {
		if (this.isWorkTime()) {
			if (this.checkInputsValidity()) {
				var beerQuantity = this.order.getOrderBeerQuantity();
				var minQuantity = pb.getFloat(pb.settings.MinOrderBeerQuantity);
				if (beerQuantity < minQuantity) {
					var message = pb.format(this.errorBeerQuantityMessage, pb.toStr(minQuantity), pb.toStr(beerQuantity));
					this.showWarningMessage(message);
				} else {
					this.showLoader("Регистрация заказа ...");
					var order = this.order.getJSON();
					$.ajax({
						url: this.config.postDataUrl,
						data: { order: JSON.stringify(order) },
						dataType: "jsonp",
						success: $.proxy(this.onPostData, this),
						error: $.proxy(this.onPostDataError, this)
					});
					this.timer = setTimeout($.proxy(this.onPostDataError, this), 30000);
				}
			}
		} else {
			this.showNotWorkTimeMessage();
		}
	},

	onPostData: function (data, textStatus, jqXHR) {
		clearTimeout(this.timer);
		this.hideLoader();
		var response = $.parseJSON(data.d);
		var status = response.status;
		if (status == 'OK') {
			this.animatePoliceCar();
		} else {
			setTimeout($.proxy(this.showWarningMessage, this, status), 500);
		}
	},

	onPostDataError: function (jqXHR, textStatus, errorThrown) {
		this.hideLoader();
		setTimeout($.proxy(this.showWarningMessage, this, this.productsErrorMessage));
	},

	checkInputsValidity: function () {
		var isValid = true;
		var address = this.addressInput.attr('value');
		if (!address) {
			isValid = false;
			this.addressError.show();

		}
		var phone = this.phoneInput.attr('value');
		if (!phone) {
			isValid = false;
			this.phoneError.show();
		}
		var acceptDelivery = this.acceptDelivery.attr('checked');
		if (!acceptDelivery) {
			isValid = false;
			this.acceptDeliveryError.show();
		}
		return isValid;
	},

	hideAllErrorMessage: function () {
		this.addressError.hide();
		this.phoneError.hide();
		this.acceptDeliveryError.hide();
	},

	onDescriptionIconClick: function (e) {
		var icon = e.target;
		var description = icon.nextSibling;
		$(icon).toggleClass('expanded');
		$(description).slideToggle();
	},

	showMessage: function (title, message, cls) {
		var overlay = this.messagePanel.getOverlay();
		var titleNode = overlay.find('.message-title');
		titleNode.removeClass();
		titleNode.addClass('message-title');
		titleNode.addClass(cls);
		titleNode.html(title);
		overlay.find('.message').html(message);
		this.messagePanel.load();
	},

	showLoader: function (message) {
		var overlay = this.loader.getOverlay();
		var messageNode = overlay.find('.loader-message');
		messageNode.html(message);
		this.loader.load();
	},

	hideLoader: function () {
		this.loader.close();
	},

	showWarningMessage: function (message) {
		this.showMessage("Внимание", message, 'warning');
	},

	showInformationMessage: function (message) {
		this.showMessage("Информация", message, 'information');
	},

	onTabsChange: function (e, index) {
		if (index == 0) {
			this.productPicture.removeClass('fish');
			this.productPicture.addClass('beer');
		} else {
			this.productPicture.removeClass('beer');
			this.productPicture.addClass('fish');
		}
	},

	animatePoliceCar: function () {
		var car = $('.police-car');
		car.animate({ right: '-=50' }, 200);
		car.animate({ right: '+=200' }, 200);
		car.animate({ right: '+=400', top: '-=200' }, 1000);
		car.animate({ right: '+=20' }, 2000);
		car.animate({ right: '-=50' }, 200);
		car.animate({ right: '+=1000', opacity: 0 }, 1000, $.proxy(this.onCarAnimationComplete, this));
	},

	onCarAnimationComplete: function () {
		$('.police-car').css({ right: 60, top: 550, opacity: 1, display: 'none' });
		this.order.clear();
		this.showInformationMessage(this.postSuccessMessage);
	}
});

pb.Order = Base.extend({
	orderTable: null,
	orderAmount: null,
	discount: 0,

	constructor: function () {
		this.orderTable = $('#orderTable');
		this.orderAmount = $('#orderAmount');
		this.initializeEvents();
		this.readCoockie();
	},

	readCoockie: function () {
		var order = $.cookie('pivbankOrder');
		if (order) {
			this.orderTable.html(order);
		}
		var orderDetails = $.cookie('pivbankOrderDetails');
		if (orderDetails) {
			var details = orderDetails.split(';')
			if (this.discount == 10) {
				$('#rbTenPercentDiscount').attr('checked', true);
			} else if (this.discount == 5) {
				$('#rbFivePercentDiscount').attr('checked', true);
			} else {
				$('#rbNoDiscount').attr('checked', true);
			}
			$('#edtAddress').val(details[1]);
			$('#edtPhone').val(details[2]);
			$('#edtDescription').val(details[3]);
		}
		this.calcOrderAmount();
		this.showOrderDetails(this.orderTable.find('tr').length > 0);
	},

	initializeEvents: function (e) {
		$('.remove-button').live('click', $.proxy(this.onRemoveButtonClick, this));
		$('.discount-percent-radiobutton input').click($.proxy(this.onDiscountRadiobuttonClick, this));
		$(window).unload($.proxy(this.saveOrderToCookie, this));
	},

	addProduct: function (product, quantity) {
		var orderItem;
		if (product.TypeName != pb.settings.BeerTypeProduct) {
			var selector = pb.applyTemplate('tr[productId="{productId}"]', { productId: product.ID });
			orderItem = this.orderTable.find(selector);
		}
		if (orderItem && (orderItem.length > 0)) {
			this.addProductQuantity(orderItem, 1);
		} else {
			this.addProductHTML(product, quantity);
		}
		this.onProductListChanged();
	},

	getCurrentQuantity: function (row) {
		var quantityNode = row.find('.quantity')
		var quantity = quantityNode.html().split(' ');
		return newQuantity = pb.getFloat(quantity[0]);
	},

	addProductQuantity: function (row, n) {
		var costNode = row.find('.cost');
		var cost = pb.getFloat(costNode.html());
		var quantityNode = row.find('.quantity')
		var quantity = quantityNode.html().split(' ');
		var oldQuantity = pb.getFloat(quantity[0]);
		var price = cost / oldQuantity;
		var newQuantity = oldQuantity + n;
		var newCost = price * newQuantity;
		quantityNode.html(pb.toStr(newQuantity) + ' ' + quantity[1]);
		costNode.html(pb.toStr(newCost.toFixed(2)));
	},

	addProductHTML: function (product, quantity, node) {
		var template = pb.concatStrings('<tr productid={productId} issnack="{isSnack}" alcohol="{alcohol}">', '<td class="remove-button-column"><input type="image" class="remove-button" src="img/s.png" title="Удалить из заказа"/></td>', '<td class="name">{name}</span></td>', '<td class="quantity">{quantity} {unit}</td>', '<td class="cost">{cost}</td>', '</tr>');
		var price = pb.getFloat(product.Price);
		var item = {
			productId: product.ID,
			isSnack: (product.TypeName != pb.settings.BeerTypeProduct) || 'false',
			alcohol: pb.getFloat(product.Alcohol) || '0',
			name: product.Name,
			quantity: pb.toStr(quantity),
			unit: product.UnitName,
			cost: pb.toStr((quantity * price).toFixed(2))
		}
		var html = pb.applyTemplate(template, item);
		if (node) {
			node.before(html);
		} else {
			this.orderTable.append(html);
		}
	},

	onRemoveButtonClick: function (e) {
		var row = $(e.target.parentNode.parentNode);
		var isSnack = (row.attr('issnack') == 'true');
		var oldQuantity = this.getCurrentQuantity(row);
		if (!isSnack || (oldQuantity == 1)) {
			var order = this;
			row.fadeOut(function () { row.remove(); order.onProductListChanged(); });

		} else {
			this.addProductQuantity(row, -1);
			this.onProductListChanged();
		}

	},

	onDiscountRadiobuttonClick: function (e) {
		var radio = e.target;
		this.discount = parseInt(radio.value);
		this.calcOrderAmount();
	},

	onProductListChanged: function () {
		this.calcOrderAmount();
		this.showOrderDetails(this.orderTable.find('tr').length > 0);
	},

	calcOrderAmount: function () {
		var items = $('#orderTable .cost');
		var amount = 0;
		for (var i = 0; i < items.length; i++) {
			var cost = pb.getFloat(items[i].innerHTML);
			amount += cost;
		}
		var amount = amount - (amount * this.discount / 100);
		var cost = "Итого: " + pb.toStr(amount.toFixed(2));
		this.orderAmount.fadeOut(function () { $(this).html(cost).fadeIn(); });
	},

	saveOrderToCookie: function () {
		var order = this.orderTable.html();
		$.cookie('pivbankOrder', order);
		var orderDetails = this.getOrderDetails();
		$.cookie('pivbankOrderDetails', orderDetails);
	},

	getOrderDetails: function () {
		var str = this.discount + ';';
		str += $('#edtAddress').val() + ';';
		str += $('#edtPhone').val() + ';';
		str += $('#edtDescription').val();
		return str;
	},

	showOrderDetails: function (visible) {
		if (visible) {
			$('.order-cost').show();
			$('.order-details-panel').show();
			$('.police-car').show();
		} else {
			$('.order-cost').hide();
			$('.order-details-panel').hide();
			$('.police-car').hide();
		}
	},

	getOrderBeerQuantity: function () {
		var products = this.orderTable.find('tr[issnack="false"]');
		var minAlcohol = pb.getFloat(pb.settings.BeerMinAlcoholQuantity);
		var beerQuantity = 0;
		for (var i = 0; i < products.length; i++) {
			var product = products[i];
			var alcohol = pb.getFloat(product.getAttribute('alcohol'));
			if (alcohol >= minAlcohol) {
				var quantity = this.getCurrentQuantity($(product));
				beerQuantity += quantity;
			}
		}
		return beerQuantity;
	},

	getOrderItems: function() {
		var products = $('#orderTable tr');
		var items = [];
		for (var i = 0; i < products.length; i++) {
			var item = {
				ProductId: products[i].getAttribute("productid"),
				Quantity: this.getCurrentQuantity($(products[i]))
			}
			items.push(item);
		}
		return items;
	},

	getJSON: function() {
		var orderItems = this.getOrderItems();
		var order = {
			Address: $('#edtAddress').val(), 
			Phone: $('#edtPhone').val(),
			Description: $('#edtDescription').val(),
			Discount: this.discount,
			Products: orderItems
		}
		return JSON.stringify(order);
	},

	clear: function() {
		this.orderTable.empty();
		this.showOrderDetails(false);
	}
});

pb.WorkTimeController = Base.extend({

	constructor: function (isOrderTime) {
		this.isOrderTime = isOrderTime;
		this.getSettings();
	},

	formatTime: function (date) {
		var minutes = date.getMinutes();
		if (minutes < 10) {
			minutes = '0' + minutes;
		}
		var time = date.getHours() + ':' + minutes;
		return time;
	},

	getSettings: function () {
		$.ajax({
			url: pb.settingsUrl + '?time=' + new Date().getTime(),
			success: $.proxy(this.onGetSettings, this),
			error: $.proxy(this.onGetSettingsError, this)
		});
	},

	onGetSettings: function (data, textStatus, jqXHR) {
		pb.settings = {};
		var items = $(data).find('item');
		for (var i = 0; i < items.length; i++) {
			var item = items[i];
			var name = item.getAttribute('Code');
			var value = item.getAttribute('Value');
			pb.settings[name] = value;
		}
		var startTime = pb.getWorkStartDate();
		var endTime = pb.getWorkEndDate();
		if (this.isOrderTime) {
			endTime = pb.getOrderEndDate();
		}
		$('#startTime').html(this.formatTime(startTime));
		$('#endTime').html(this.formatTime(endTime));
	},

	onGetSettingsError: function (jqXHR, textStatus, errorThrown) {

	}

});
