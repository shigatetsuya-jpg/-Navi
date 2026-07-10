<%@ page language="java" contentType="text/html; charset=utf-8"
	pageEncoding="utf-8"%>
<!DOCTYPE html>
<%@ taglib prefix="c" uri="jakarta.tags.core" %>
<%@ taglib prefix="sql" uri="jakarta.tags.sql" %>
<%@ taglib prefix="fmt" uri="jakarta.tags.fmt" %>

<sql:setDataSource driver="org.h2.Driver" url="jdbc:h2:~/h2db/mydb" />

<%
  String sessionId = session.getId();
  String action = request.getParameter("action");

  String setId = request.getParameter("setId");
  String setName = request.getParameter("setName");
  String price = request.getParameter("price");
  String size = request.getParameter("size");
  String quantity = request.getParameter("quantity");

  if (setId != null && !setId.isEmpty() && size != null && !size.isEmpty()) {
    String productCode = "SET-" + setId;
%>
    <sql:update>
      INSERT INTO SHOPPING_CART (SESSION_ID, PRODUCT_CODE, SET_NAME, PRODUCT_SIZE, PRICE, QUANTITY)
      VALUES (?, ?, ?, ?, ?, ?)
      <sql:param value="<%= sessionId %>" />
      <sql:param value="<%= productCode %>" />
      <sql:param value="<%= setName %>" />
      <sql:param value="<%= size %>" />
      <sql:param value="<%= price %>" />
      <sql:param value="<%= quantity %>" />
    </sql:update>
<%
  } else if ("delete".equals(action)) {
    String cartId = request.getParameter("cartId");
    if (cartId != null && !cartId.isEmpty()) {
%>
      <sql:update>
        DELETE FROM SHOPPING_CART WHERE CART_ID = ?
        <sql:param value="<%= cartId %>" />
      </sql:update>
<%
    }
  }
%>

<sql:query var="cartItems">
  SELECT CART_ID, PRODUCT_CODE, SET_NAME, PRODUCT_SIZE, PRICE, QUANTITY, (PRICE * QUANTITY) as SUBTOTAL
  FROM SHOPPING_CART
  WHERE SESSION_ID = ?
  <sql:param value="<%= sessionId %>" />
</sql:query>

<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<TITLE>ショッピングカート</TITLE>
<STYLE type="text/css">
body {background-color:white; font-family:Arial, sans-serif;}
.header {background-color:#333333; color:white; padding:10px; text-align:center;}
.header a {color:white; text-decoration:none; margin:0 10px;}
.container {padding:20px; max-width:900px; margin:0 auto;}
table {border-collapse:collapse; width:100%; margin:20px 0;}
th, td {border:1px solid #ddd; padding:12px; text-align:left;}
th {background-color:#333333; color:white; font-weight:bold;}
tr:nth-child(even) {background-color:#f9f9f9;}
.total-section {background-color:#f0f0f0; padding:15px; text-align:right; font-size:18px; font-weight:bold; margin:20px 0;}
.delete-form {display:inline;}
.delete-button {background-color:#cc0000; color:white; padding:5px 10px; border:none; cursor:pointer; border-radius:3px;}
.delete-button:hover {background-color:#990000;}
button.checkout-button {background-color:#4CAF50; color:white; padding:10px 20px; cursor:pointer; border:none; margin:5px; border-radius:3px; font-size:16px;}
button.checkout-button:hover {background-color:#45a049;}
button.back-button {background-color:#333333; color:white; padding:10px 20px; cursor:pointer; border:none; margin:5px; border-radius:3px;}
button.back-button:hover {background-color:#555555;}
.button-container {text-align:center; margin:20px 0;}
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
		<H2>ショッピングカート</H2>

		<c:if test="${empty cartItems.rows}">
			<div class="empty-message">
				カートは空です。<BR><BR>
				<a href="list4.jsp">商品一覧に戻る</a>
			</div>
		</c:if>

		<c:if test="${not empty cartItems.rows}">
			<table>
				<tr>
					<th>商品名</th>
					<th>サイズ</th>
					<th>数量</th>
					<th>単価</th>
					<th>小計</th>
					<th>操作</th>
				</tr>
				<c:set var="total" value="0" />
				<c:forEach var="item" items="${cartItems.rows}">
					<tr>
						<td>${item.SET_NAME}</td>
						<td>${item.PRODUCT_SIZE}</td>
						<td>${item.QUANTITY}</td>
						<td>${item.PRICE}円</td>
						<td>${item.SUBTOTAL}円</td>
						<td>
							<form action="cart.jsp" method="POST" class="delete-form">
								<input type="hidden" name="action" value="delete">
								<input type="hidden" name="cartId" value="${item.CART_ID}">
								<button type="submit" class="delete-button">削除</button>
							</form>
						</td>
					</tr>
					<c:set var="total" value="${total + item.SUBTOTAL}" />
				</c:forEach>
			</table>

			<div class="total-section">
				お支払い総額: ${total}円
			</div>

			<div class="button-container">
				<form action="checkout.jsp" method="POST" style="display:inline;">
					<input type="hidden" name="total" value="${total}">
					<button type="submit" class="checkout-button">購入手続きへ</button>
				</form>
				<a href="list4.jsp"><button type="button" class="back-button">買い物を続ける</button></a>
			</div>
		</c:if>
	</div>

</BODY>
</HTML>
