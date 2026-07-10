<%@ page language="java" contentType="text/html; charset=utf-8"
	pageEncoding="utf-8"%>
<!DOCTYPE html>
<%@ taglib prefix="c" uri="jakarta.tags.core" %>
<%@ taglib prefix="sql" uri="jakarta.tags.sql" %>
<%@ taglib prefix="fmt" uri="jakarta.tags.fmt" %>

<sql:setDataSource driver="org.h2.Driver" url="jdbc:h2:~/h2db/mydb" />

<sql:query var="stockList">
  SELECT
    ps.SET_ID,
    ps.SET_NAME,
    ps.CATEGORY_NAME,
    ps.MAKER_NAME,
    COALESCE(pss.STOCK_NUM, 0) as STOCK_NUM
  FROM PRODUCT_SET ps
  LEFT JOIN PRODUCT_SET_STOCK pss ON ps.SET_ID = pss.SET_ID
  ORDER BY ps.SET_ID
</sql:query>

<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<TITLE>在庫確認</TITLE>
<STYLE type="text/css">
body {background-color:white; font-family:Arial, sans-serif; margin:0; padding:0;}
.header {background-color:#333333; color:white; padding:15px; text-align:center;}
.header h2 {margin:0;}
.header a {color:white; text-decoration:none; margin:0 15px;}
.header a:hover {text-decoration:underline;}
.container {padding:20px; max-width:900px; margin:0 auto;}
table {border-collapse:collapse; width:100%; margin:20px 0;}
th, td {border:1px solid #ddd; padding:12px; text-align:left;}
th {background-color:#333333; color:white; font-weight:bold;}
tr:nth-child(even) {background-color:#f9f9f9;}
.stock-ok {color:green; font-weight:bold;}
.stock-low {color:#e69500; font-weight:bold;}
.stock-none {color:red; font-weight:bold;}
</STYLE>
</head>
<BODY>

	<%-- ヘッダー --%>
	<div class="header">
	    <h2>MIND/STYLE</h2>
	    <a href="list4.jsp">一覧</a>
	    <a href="search.jsp">検索</a>
	    <a href="cart.jsp">カート</a>
	</div>

	<div class="container">
		<H2>在庫確認</H2>

		<table>
			<tr>
				<th>セットID</th>
				<th>セット名</th>
				<th>カテゴリー</th>
				<th>メーカー</th>
				<th>在庫数</th>
			</tr>
			<c:forEach var="row" items="${stockList.rows}">
				<tr>
					<td>${row.SET_ID}</td>
					<td>${row.SET_NAME}</td>
					<td>${row.CATEGORY_NAME}</td>
					<td>${row.MAKER_NAME}</td>
					<td>
						<c:choose>
							<c:when test="${row.STOCK_NUM <= 0}">
								<span class="stock-none">在庫なし (${row.STOCK_NUM})</span>
							</c:when>
							<c:when test="${row.STOCK_NUM <= 3}">
								<span class="stock-low">残りわずか (${row.STOCK_NUM})</span>
							</c:when>
							<c:otherwise>
								<span class="stock-ok">${row.STOCK_NUM}</span>
							</c:otherwise>
						</c:choose>
					</td>
				</tr>
			</c:forEach>
		</table>
	</div>

</BODY>
</HTML>
