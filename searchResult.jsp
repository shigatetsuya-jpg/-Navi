<%@ page language="java" contentType="text/html; charset=utf-8"
	pageEncoding="utf-8"%>
<!DOCTYPE html>
<%@ taglib prefix="c" uri="jakarta.tags.core" %>
<%@ taglib prefix="sql" uri="jakarta.tags.sql" %>
<%@ taglib prefix="fmt" uri="jakarta.tags.fmt" %>
<%@ taglib prefix="fn" uri="jakarta.tags.functions"%>

<sql:setDataSource driver="org.h2.Driver" url="jdbc:h2:~/h2db/mydb" />

<fmt:requestEncoding value="utf-8" />

<%
  String keyword = request.getParameter("keyword");
  String categoryName = request.getParameter("categoryName");
  String makerName = request.getParameter("makerName");

  if (keyword == null) keyword = "";
  if (categoryName == null) categoryName = "";
  if (makerName == null) makerName = "";
%>

<sql:query var="searchResults">
  SELECT
    ps.SET_ID,
    ps.SET_NAME,
    ps.SET_PRICE,
    ps.SET_IMAGE,
    ps.CATEGORY_NAME,
    ps.MAKER_NAME,
    COALESCE(pss.STOCK_NUM, 0) as STOCK_NUM
  FROM PRODUCT_SET ps
  LEFT JOIN PRODUCT_SET_STOCK pss ON ps.SET_ID = pss.SET_ID
  WHERE 1=1
  <c:if test="${not empty param.keyword}">
    AND ps.SET_NAME LIKE CONCAT('%', ?, '%')
  </c:if>
  <c:if test="${not empty param.categoryName}">
    AND ps.CATEGORY_NAME = ?
  </c:if>
  <c:if test="${not empty param.makerName}">
    AND ps.MAKER_NAME = ?
  </c:if>
  ORDER BY ps.SET_ID
  <c:if test="${not empty param.keyword}">
    <sql:param value="${param.keyword}" />
  </c:if>
  <c:if test="${not empty param.categoryName}">
    <sql:param value="${param.categoryName}" />
  </c:if>
  <c:if test="${not empty param.makerName}">
    <sql:param value="${param.makerName}" />
  </c:if>
</sql:query>

<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<TITLE>検索結果</TITLE>
<STYLE type="text/css">
body {background-color:white; font-family:Arial, sans-serif; margin:0; padding:0;}
.header {background-color:#333333; color:white; padding:15px; text-align:center;}
.header h2 {margin:0;}
.header a {color:white; text-decoration:none; margin:0 15px;}
.header a:hover {text-decoration:underline;}
.container {padding:20px; max-width:1200px; margin:0 auto;}
.product-grid {display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:20px; margin-top:20px;}
.product-card {border:1px solid #ddd; border-radius:8px; padding:15px; text-align:center; background:#f9f9f9; transition:transform 0.2s;}
.product-card:hover {transform:translateY(-5px); box-shadow:0 4px 8px rgba(0,0,0,0.1);}
.product-card img {max-width:100%; height:auto; max-height:200px; margin-bottom:10px;}
.product-card h3 {margin:10px 0; font-size:16px;}
.product-card .price {font-size:18px; font-weight:bold; color:#333; margin:10px 0;}
.product-card .stock {font-size:14px; margin:10px 0;}
.stock-available {color:green;}
.stock-unavailable {color:red;}
.product-card button {background-color:#333333; color:white; padding:10px 15px; border:none; cursor:pointer; width:100%; box-sizing:border-box; border-radius:4px; font-size:14px;}
.product-card button:hover {background-color:#555555;}
.search-info {background-color:#f0f0f0; padding:15px; border-radius:4px; margin:15px 0;}
.empty-message {text-align:center; padding:40px; font-size:18px; color:#666;}
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
		<H2>検索結果</H2>

		<div class="search-info">
			<p>
				<c:if test="${not empty param.keyword}">
					キーワード: <strong>${param.keyword}</strong>
				</c:if>
				<c:if test="${not empty param.categoryName}">
					<c:if test="${not empty param.keyword}"> | </c:if>
					カテゴリー: <strong>${param.categoryName}</strong>
				</c:if>
				<c:if test="${not empty param.makerName}">
					<c:if test="${not empty param.keyword or not empty param.categoryName}"> | </c:if>
					メーカー: <strong>${param.makerName}</strong>
				</c:if>
				<c:if test="${empty param.keyword and empty param.categoryName and empty param.makerName}">
					条件なし
				</c:if>
			</p>
		</div>

		<c:if test="${empty searchResults.rows}">
			<div class="empty-message">
				検索結果がありません。<BR><BR>
				<a href="search.jsp">検索画面に戻る</a>
			</div>
		</c:if>

		<c:if test="${not empty searchResults.rows}">
			<p>検索結果: ${fn:length(searchResults.rows)}件</p>
			<div class="product-grid">
				<c:forEach var="row" items="${searchResults.rows}">
					<div class="product-card">
						<img src="image/${row.SET_IMAGE}" alt="${row.SET_NAME}" />
						<h3>${row.SET_NAME}</h3>
						<div class="price">${row.SET_PRICE}円</div>
						<div class="stock">
							<c:choose>
								<c:when test="${row.STOCK_NUM > 0}">
									<span class="stock-available">在庫あり</span>
								</c:when>
								<c:otherwise>
									<span class="stock-unavailable">在庫なし</span>
								</c:otherwise>
							</c:choose>
						</div>
						<form action="detail.jsp" method="POST" style="margin:0;">
							<input type="hidden" name="selectedSetId" value="${row.SET_ID}">
							<button type="submit">詳細</button>
						</form>
					</div>
				</c:forEach>
			</div>
		</c:if>

		<div style="margin-top:20px; text-align:center;">
			<a href="search.jsp">検索画面に戻る</a> | <a href="list4.jsp">商品一覧に戻る</a>
		</div>
	</div>

</BODY>
</HTML>
