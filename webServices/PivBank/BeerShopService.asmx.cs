using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Services;
using System.IO;
using System.Text;
using System.Xml;
using System.Web.Script.Services;
using System.Web.Script.Serialization;

namespace Pivbank
{
	/// <summary>
	/// Сводное описание для WebService1
	/// </summary>
	[WebService(Namespace = "http://tempuri.org/")]
	[WebServiceBinding(ConformsTo = WsiProfiles.BasicProfile1_1)]
	[System.ComponentModel.ToolboxItem(false)]
	[ScriptService]
	public class BeerShopService : System.Web.Services.WebService
	{

		#region Methods: Public

		[WebMethod]
		[ScriptMethod(UseHttpGet = true, ResponseFormat = ResponseFormat.Json)]
		public string GetProducts() {
			string fileName = System.Configuration.ConfigurationManager.AppSettings["ProductsXml"];
			XmlDocument xml = new XmlDocument();
			xml.Load(fileName);
			return XmlUtils.XmlToJSON(xml);
		}

		[WebMethod]
		[ScriptMethod(UseHttpGet = true, ResponseFormat = ResponseFormat.Json)]
		public string AddOrder(string order) {
			var serializer = new JavaScriptSerializer();
			try {
				TSUtils.ConnectToTS();
			} catch (Exception Error) {
				//string message = "Ошибка соединения с базой данных. Повторите попытку через несколько минут.";
				string message = "По техническим причинам заказы через сайт в данное время не принимаются. Для заказа используйте телефон 67-07-51. Извините за неудобства.";
				return string.Format("{{\"status\": \"{0}\"}}", message);
			}
			OrderRegistrator registrator = new Pivbank.OrderRegistrator(order);
			string status = registrator.Register();
			TSUtils.CloseTSConfiguration();
			return string.Format("{{\"status\": \"{0}\"}}", status);
		}

		#endregion
	}
}
