<%@ page language="java" contentType="text/html; charset=utf-8"
	pageEncoding="utf-8"%>
<!DOCTYPE html>
<%@ taglib prefix="c" uri="jakarta.tags.core" %>
<%@ taglib prefix="sql" uri="jakarta.tags.sql" %>
<%@ taglib prefix="fmt" uri="jakarta.tags.fmt" %>
<%@ taglib prefix="fn" uri="jakarta.tags.functions"%>

<sql:setDataSource driver="org.h2.Driver" url="jdbc:h2:~/h2db/mydb" />

<sql:query var="categoryList">
  SELECT DISTINCT CATEGORY_NAME FROM PRODUCT_SET ORDER BY CATEGORY_NAME;
</sql:query>

<sql:query var="makerList">
  SELECT DISTINCT MAKER_NAME FROM PRODUCT_SET ORDER BY MAKER_NAME;
</sql:query>

<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<TITLE>商品検索</TITLE>
<STYLE type="text/css">
body {background-color:white;}
.header {background-color:#333333; color:white; padding:10px; text-align:center;}
.header a {color:white; text-decoration:none; margin:0 10px;}
table {border-collapse:separate; border-spacing:2px; width:100%;}
th {background-color:#333333; text-align:center; font-size:large; font-weight:bold; color:white;}
td {background-color:#EFEFEF; font-size:normal; color:black;}
select, input {width:100%; padding:5px; box-sizing:border-box;}
button {background-color:#333333; color:white; padding:10px 20px; cursor:pointer; border:none; margin:5px;}
button:hover {background-color:#555555;}
</STYLE>
</head>
<BODY>

	<%-- ヘッダー --%>
		<div class="header">
		<H2>MIND/STYLE</H2>
		<a href="list4.jsp">一覧</a>
		<a href="search.jsp">検索</a>
		<a href="cart.jsp">カート</a>
	</div>

	<CENTER>
		<FORM action="searchResult.jsp" method="POST">

			<H2>商品検索</H2>

			<TABLE border="1">
				<TR>
					<TD>キーワード検索</TD>
					<TD><input type="text" name="keyword" placeholder="セット名で検索..."></TD>
				</TR>
				<TR>
					<TD>カテゴリー</TD>
					<TD>
						<select name="categoryName">
							<option value="">--全て--</option>
							<c:forEach var="row" items="${categoryList.rows}">
								<option value="${row.CATEGORY_NAME}">${row.CATEGORY_NAME}</option>
							</c:forEach>
						</select>
					</TD>
				</TR>
				<TR>
					<TD>メーカー</TD>
					<TD>
						<select name="makerName">
							<option value="">--全て--</option>
							<c:forEach var="row" items="${makerList.rows}">
								<option value="${row.MAKER_NAME}">${row.MAKER_NAME}</option>
							</c:forEach>
						</select>
					</TD>
				</TR>
			</TABLE>

			<BR>
			<button type="submit">検索実行</button>
			<BR><BR>
			<a href="list4.jsp">戻る</a>
		</FORM>
	</CENTER>
</BODY>
</HTML>
