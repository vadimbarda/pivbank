using System;
using System.Collections.Generic;
using System.Configuration;
using System.Linq;
using System.Web;
using TSObjectLibrary;


namespace Pivbank
{

	public class TSUtils
	{

		#region Constructors: Public

		public TSUtils() {
		}

		#endregion

		#region Properties: Public

		public static Connector TSConnector {
			get;
			set;
		}

		#endregion

		#region Methods: Public

		public static IService GetTSServiceByCode(string ServiceCode) {
			return TSConnector.Services.GetNewItemByUSI(ServiceCode);
		}

		public static DBDataset GetDatasetByCode(string DatasetCode) {
			return (DBDataset)GetTSServiceByCode(DatasetCode);
		}

		public static string GenNewKeyValueFromCollection(ICoreCollection Collection, string KeyValueCode) {
			string ItemKeyValue;
			for (var i = 0; i < Collection.Count; i++) {
				ItemKeyValue = KeyValueCode + (i + 1).ToString();
				if ((Collection.get_CoreItemsByKey(ItemKeyValue) == null)) {
					return ItemKeyValue;
				}
			}
			return KeyValueCode;
		}

		public static void ConnectToTSConfiguration(string Configuration, string Login, string Password) {
			TSConnector = new Connector();
			TSConnector.OpenConfigurationByName(Configuration, AuthenticationModeEnum.amDatabaseServer, Login, Password);
		}

		public static void CloseTSConfiguration() {
			if (TSConnector != null) {
				TSConnector.CloseConfiguration();
			}
		}

		public static bool IsEmptyConfiguration() {
			return ((TSConnector == null) || (TSConnector.CurrentConfiguration == null));
		}

		public static void ApplyDatasetFilter(DBDataset Dataset, string FilterName, object ParamValue, bool Enabled) {
			EnableDatasetFilter(Dataset, FilterName, Enabled);
			SetDatasetParameter(Dataset, FilterName, ParamValue);
		}

		public static void SetDatasetParameter(DBDataset Dataset, string ParameterName, object ParamValue) {
			SelectQuery sq = Dataset.SelectQuery;
			sq.Parameters[ParameterName].Value = ParamValue;
		}

		public static void EnableDatasetFilter(DBDataset Dataset, string FilterName, bool Enabled) {
			SelectQuery sq = Dataset.SelectQuery;
			sq.get_Items(0).Filters[FilterName].IsEnabled = Enabled;
		}

		public static GeneralColumn AddGeneralColumn(Columns Columns, TableField Field, bool IsEnabled, bool CanDisabled) {
			GeneralColumn Column = Columns.CreateGeneralColumn();
			Column.Field = Field;
			Column.IsEnabled = IsEnabled;
			Column.CanDisable = CanDisabled;
			Columns.Add(Column);
			return Column;
		}

		public static Parameter AddParameter(Parameters Parameters, string Name, ParamDataTypeEnum DataType) {
			Parameter Parameter = new Parameter();
			Parameter.Name = Name;
			Parameter.DataType = DataType;
			Parameters.Add(Parameter);
			return Parameter;
		}

		public static CompareFilter AddCompareFilter(SelectQuery SelectQuery, string FieldName, IParameter Parameter) {
			Filters Filters = SelectQuery.get_Items(0).Filters;
			TableField Field = SelectQuery.get_Items(0).FromTable.Fields[FieldName];
			CompareFilter Filter = Filters.CreateCompareFilter();
			Filter.Code = FieldName;
			FieldFilterExpression TestExpression = Filter.CreateFieldFilterExpression();
			ParamFilterExpression ValueExpression = Filter.CreateParamFilterExpression();
			TestExpression.Field = Field;
			ValueExpression.Parameter = Parameter;
			Filter.TestExpression = TestExpression;
			Filter.ValueExpression = ValueExpression;
			Filters.Add(Filter);
			return Filter;
		}

		public static IsNullFilter AddIsNullFilter(SelectQuery SelectQuery, string FieldName) {
			Filters Filters = SelectQuery.get_Items(0).Filters;
			TableField Field = SelectQuery.get_Items(0).FromTable.Fields[FieldName];
			IsNullFilter IsNullFilter = Filters.CreateIsNullFilter();
			IsNullFilter.Code = FieldName;
			IsNullFilter.KeyValue = FieldName;
			string FromTableAlias = Filters.ParentSelect.FromTableAlias;
			IsNullFilter.TestExpression = AddFieldExpression(Filters, IsNullFilter, Field, FromTableAlias);
			Filters.Add(IsNullFilter);
			return IsNullFilter;
		}

		public static IncludeFilter AddIncludeFilter(SelectQuery SelectQuery, string FieldName, string[] IDs) {
			Filters Filters = SelectQuery.get_Items(0).Filters;
			TableField Field = SelectQuery.get_Items(0).FromTable.Fields[FieldName];
			IncludeFilter Filter = Filters.CreateIncludeFilter();
			Filter.Code = FieldName + "_Include";
			FieldFilterExpression TestExpression = Filter.CreateFieldFilterExpression();
			TestExpression.Field = Field;
			Filter.TestExpression = TestExpression;
			for (var i = 0; i < IDs.Length; i++) {
				string ID = IDs[i];
				ParamFilterExpression ValueExpression = Filter.CreateParamFilterExpression();
				Parameter Parameter = AddParameter(SelectQuery.Parameters, "Expression"+i.ToString(), ParamDataTypeEnum.pdtUnicodeString);
				Parameter.Value = ID;
				ValueExpression.Parameter = Parameter;
				ValueExpression.Code = "Code" + i.ToString();
				Filter.ValuesExpressions.Add(ValueExpression);
			}
			Filters.Add(Filter);
			return Filter;
		}


		public static FieldFilterExpression AddFieldExpression(Filters Filters, IFilter Filter, TableField Field, string FieldTableAlias) {
			FieldFilterExpression FieldFilterExpression = Filter.CreateFieldFilterExpression();
			FieldFilterExpression.Code = GenNewKeyValueFromCollection(Filters, "FieldFilterExpression");
			FieldFilterExpression.Field = Field;
			FieldFilterExpression.TableAlias = FieldTableAlias;
			return FieldFilterExpression;
		}

		private static SelectQuery GenerateSelectQuery(Table Table, string[] FieldNames, int Top) {
			SelectQuery Query = (SelectQuery)TSConnector.Services.CreateItem("SelectQuery");
			Select Select = Query.CreateItem();
			Select.Top = Top;
			Select.FromTable = Table;
			Query.Add(Select);
			int ColumnsCount = FieldNames.Length;
			for (var i = 0; i < ColumnsCount; i++) {
				String FieldName = FieldNames[i];
				TableField Field = Table.Fields[FieldName];
				AddGeneralColumn(Query.Columns, Field, true, false);
			}
			return Query;
		}

		public static DateTime GetMSSQLNullDate() {
			return new DateTime(1899, 12, 30);
		}

		public static void SetDatasetFieldOrdering(DBDataset Dataset, String FieldName,
				OrderTypeEnum OrderType, int Position) {
			if (Dataset.SelectQuery.Columns[FieldName] != null) {
				Dataset.SelectQuery.Columns[FieldName].OrderType = OrderType;
				Dataset.SelectQuery.Columns[FieldName].OrderPosition = Position;
			}
		}

		public static void ConnectToTS() {
			string ConfigName = System.Configuration.ConfigurationManager.AppSettings["TSConfigName"];
			string TSLogin = System.Configuration.ConfigurationManager.AppSettings["TSLogin"];
			string TSPassword = System.Configuration.ConfigurationManager.AppSettings["TSPassword"];
			ConnectToTSConfiguration(ConfigName, TSLogin, TSPassword);
		}

		public static string GetTSSystemSetting(string fieldName, string code) {
			DBDataset SystemSettingsDataset = GetDatasetByCode("ds_SystemSetting");
			ApplyDatasetFilter(SystemSettingsDataset, "Code", code, true);
			SystemSettingsDataset.Open();
			string stringValue = string.Empty;
			if (!SystemSettingsDataset.IsEmptyPage) {
				stringValue = SystemSettingsDataset.get_ValAsStr(fieldName);
			}
			SystemSettingsDataset.Close();
			return stringValue;
		}

		public static string GetTSStringSystemSetting(string code) {
			return GetTSSystemSetting("StringValue", code);
		}

		public static string GetTSIntegerSystemSetting(string code) {
			return GetTSSystemSetting("IntegerValue", code);
		}

		public static string GetTSLookupSystemSetting(string code) {
			return GetTSSystemSetting("DictionaryRecordID", code);
		}

		public static DateTime GetTSDateTimeSystemSetting(string code) {
			DBDataset SystemSettingsDataset = GetDatasetByCode("ds_SystemSetting");
			ApplyDatasetFilter(SystemSettingsDataset, "Code", code, true);
			SystemSettingsDataset.Open();
			DateTime dateTimeValue = DateTime.MinValue;
			if (!SystemSettingsDataset.IsEmptyPage) {
				dateTimeValue = SystemSettingsDataset.get_ValAsDateTime("DateTimeValue");
			}
			SystemSettingsDataset.Close();
			return dateTimeValue;
		}

		#endregion

	}
}