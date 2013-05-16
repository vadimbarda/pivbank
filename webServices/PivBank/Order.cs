using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Script.Serialization;

namespace Pivbank
{
	
	#region Class: TOrder

	#region Properties: Public

	public class TOrder
	{

		public string Address,Phone, Description;
		public int Discount;
		public List<TProduct> Products; 

	#endregion
	
	}
	
	#endregion

	#region Class: TProduct

	public class TProduct
	{
		#region Properties: Public

		public string ProductId, Caption, Unit;
		public double Quantity, Price;

		#endregion

	}

	#endregion

	#region Class ShortOrderItem

	public class ShortOrderItem
	{

		#region Constructors:Public

		public ShortOrderItem(string productName, double quantity, string unit) {
			ProductName = productName;
			Quantity = quantity;
			Unit = unit;
		}

		#endregion

		#region Properties:Public

		public string ProductName {
			get;
			set;
		}

		public double Quantity {
			get;
			set;
		}

		public string Unit {
			get;
			set;
		}

		#endregion

	}

	#endregion

	#region Class: OrderRegistrator

	public class OrderRegistrator
	{

		#region Constructors: Public

		public OrderRegistrator(string order) {
			var serializer = new JavaScriptSerializer();
			Order = serializer.Deserialize<TOrder>(order);
			serializer.Serialize("ddd");
			TSBeerTypeProduct = TSUtils.GetTSLookupSystemSetting("BeerTypeProduct");
			TSForBeerTypeProduct = TSUtils.GetTSLookupSystemSetting("ForBeerTypeProduct");
			TSWebOrderType = TSUtils.GetTSLookupSystemSetting("WebOrderType");
			TSNewOrderState = TSUtils.GetTSLookupSystemSetting("NewOrderState");
			ProductDataset = TSUtils.GetDatasetByCode("ds_Product");
			ApplyProductsFilter(ProductDataset);
			ProductDataset.Open();
		}

		#endregion

		#region Properties: Private

		private string TSBeerTypeProduct {
			get;
			set;
		}

		private string TSForBeerTypeProduct {
			get;
			set;
		}

		private string TSWebOrderType {
			get;
			set;
		}

		private string TSNewOrderState {
			get;
			set;
		}

		#endregion

		#region Properties: Public

		public TOrder Order {
			get;
			set;
		}

		public TSObjectLibrary.DBDataset ProductDataset {
			get;
			set;
		}

		public Dictionary<string, ShortOrderItem> ShortOrder {
			get {
				Dictionary<string, ShortOrderItem> shortOrder = new Dictionary<string, ShortOrderItem>();
				foreach (TProduct item in Order.Products) {
					if (shortOrder.ContainsKey(item.ProductId)) {
						ShortOrderItem shortItem = shortOrder[item.ProductId];
						shortItem.Quantity += item.Quantity;
					} else {
						shortOrder[item.ProductId] = new ShortOrderItem(item.Caption, item.Quantity, item.Unit);
					}
				}
				return shortOrder;
			}
		}

		#endregion

		#region Methods: Private

		private void SetProductFields(List<TProduct> productList) {
			foreach (TProduct item in productList) {
				if (ProductDataset.Locate("ID", item.ProductId)) {
					item.Unit = ProductDataset.get_ValAsStr("UnitName");
					item.Price = ProductDataset.get_ValAsFloat("Price");
					item.Caption = ProductDataset.get_ValAsStr("Name");
				}
			}
		}

		private void ApplyProductsFilter(TSObjectLibrary.DBDataset ProductDataset) { 
			string[] IDs = new string[Order.Products.Count];
			int i=0;
			foreach (KeyValuePair<string, ShortOrderItem> item in ShortOrder) {
				ShortOrderItem shortOrderItem = item.Value;
				IDs.SetValue(item.Key, i);
				i++;
			}
			TSUtils.AddIncludeFilter(ProductDataset.SelectQuery, "ID", IDs);
		}
		
		private Dictionary<string, ShortOrderItem> GetShortOrderList(List<TProduct> productList) {
			Dictionary<string, ShortOrderItem> shortOrder = new Dictionary<string,ShortOrderItem>();
			foreach (TProduct item in productList) {
				if (shortOrder.ContainsKey(item.ProductId)) {
					ShortOrderItem shortItem = shortOrder[item.ProductId];
					shortItem.Quantity += item.Quantity;
				} else {
					shortOrder[item.ProductId] = new ShortOrderItem(item.Caption, item.Quantity, item.Unit);
				}
			}
			return shortOrder;
		}

		private string GetProductException(string productName, string unit, double orderQuantity, double saleQuantity) {
			string messageTemplate = "<p>В данный момент в наличии есть только {3}{1} '{0}', а в Вашем заказе {2}{1}</p>";
			return string.Format(messageTemplate, productName, unit, orderQuantity, saleQuantity);
		}

		private string GetProductUnrealQuantityException(string productName, double orderQuantity, string unit, int minQuantity, int maxQuantity) {
			string messageTemplate = "<p>Количество должно быть в пределах от {3} до {4}, а в Вашем заказе {0} {1}{2}</p>";
			return string.Format(messageTemplate, productName, orderQuantity, unit, minQuantity, maxQuantity);
		}

		
		private string CheckProductQuantity(Dictionary<string, ShortOrderItem> shortOrderList) {
			int minQuantity = 1;
			int maxQuantity = 40;
			string errorMessages = String.Empty;
			string value = TSUtils.GetTSIntegerSystemSetting("MinSalesBeerQuantity");
			int minSalesBeerQuantity = int.Parse(value);
			foreach (KeyValuePair<string, ShortOrderItem> item in shortOrderList) {
				ShortOrderItem shortOrderItem = item.Value;
				if ((item.Value.Quantity < minQuantity) || (item.Value.Quantity > maxQuantity)) {
					errorMessages += GetProductUnrealQuantityException(shortOrderItem.ProductName, shortOrderItem.Quantity, shortOrderItem.Unit, minQuantity, maxQuantity);
				}
				if (ProductDataset.Locate("ID", item.Key)) {
					int minSalesQuantity = 0;
					if (ProductDataset.get_ValAsStr("TypeID") == TSBeerTypeProduct) {
						minSalesQuantity = minSalesBeerQuantity;	
					}
					var saleQuantity = ProductDataset.get_ValAsFloat("Balance") - ProductDataset.get_ValAsFloat("Reserve") - minSalesQuantity;
					bool isActive = ProductDataset.get_ValAsBool("IsActive");
					if (!isActive) {
						saleQuantity = 0;
					}
					if ((item.Value.Quantity > saleQuantity) || !isActive) {
						saleQuantity = Math.Max(0, saleQuantity);
						errorMessages += GetProductException(shortOrderItem.ProductName, shortOrderItem.Unit, shortOrderItem.Quantity, saleQuantity);
					}
				} else {
					errorMessages += GetProductException(shortOrderItem.ProductName, shortOrderItem.Unit, shortOrderItem.Quantity, 0);
				}
			}
			return errorMessages;
		}

		private string AddNewOrder(TOrder order) {
			TSObjectLibrary.DBDataset orderDataset = TSUtils.GetDatasetByCode("ds_Order");
			orderDataset.Append();
			orderDataset.set_ValAsStr("TypeID", TSWebOrderType);
			orderDataset.set_ValAsStr("StateID", TSNewOrderState);
			orderDataset.set_ValAsStr("ContactPhone", order.Phone);
			orderDataset.set_ValAsStr("DeliveryAddress", order.Address);
			orderDataset.set_ValAsInt("DiscountPercent", order.Discount);
			orderDataset.set_ValAsStr("Info", order.Description);
			orderDataset.Post();
			return orderDataset.get_ValAsStr("ID");
		}

		private void AddOrderProducts(string orderId, List<TProduct> productList) {
			TSObjectLibrary.DBDataset productInOrderDataset = TSUtils.GetDatasetByCode("ds_ProductInOrder");
			foreach (TProduct item in productList) {
				productInOrderDataset.Append();
				productInOrderDataset.set_ValAsStr("OrderID", orderId);
				productInOrderDataset.set_ValAsStr("ProductID", item.ProductId);
				productInOrderDataset.set_ValAsFloat("Quantity", item.Quantity);
				productInOrderDataset.set_ValAsFloat("Price", item.Price);
				productInOrderDataset.Post();
			}
		}


		#endregion

		#region Methods: Public

		public string Register() {
			string message = "OK";
			SetProductFields(Order.Products);
			Dictionary<string, ShortOrderItem> shortList = GetShortOrderList(Order.Products);
			string errorMessages = CheckProductQuantity(shortList);
			if (errorMessages == string.Empty) {
				string orderId = AddNewOrder(Order);
				AddOrderProducts(orderId, Order.Products);
			} else {
				message = errorMessages;
			}
			ProductDataset.Close();
			var serializer = new JavaScriptSerializer();
			string serialized = message.Replace("\"", "'");
			return serialized;
		}

		#endregion

	}

	#endregion

}