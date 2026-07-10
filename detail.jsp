<%@ page language="java" contentType="text/html; charset=utf-8"
	pageEncoding="utf-8"%>
<!DOCTYPE html>
<%@ taglib prefix="c" uri="jakarta.tags.core" %>
<%@ taglib prefix="sql" uri="jakarta.tags.sql" %>
<%@ taglib prefix="fmt" uri="jakarta.tags.fmt" %>
<%@ taglib prefix="fn" uri="jakarta.tags.functions"%>

<sql:setDataSource driver="org.h2.Driver" url="jdbc:h2:~/h2db/mydb" />

<fmt:requestEncoding value="utf-8" />
<c:set var="setId" value="${param.selectedSetId}" />

<sql:query var="setDetail">
  SELECT
    ps.SET_ID,
    ps.SET_NAME,
    ps.SET_PRICE,
    ps.SET_DETAIL,
    ps.CATEGORY_NAME,
    ps.MAKER_NAME,
    ps.MATERIAL,
    ps.SIZE,
    ps.SET_IMAGE,
    pss.STOCK_NUM
  FROM PRODUCT_SET ps
  LEFT JOIN PRODUCT_SET_STOCK pss ON ps.SET_ID = pss.SET_ID
  WHERE ps.SET_ID = ?
  <sql:param value="${setId}" />
</sql:query>

<sql:query var="setItems">
  SELECT
    psi.PRODUCT_CODE,
    psi.PRODUCT_NAME,
    psi.QUANTITY,
    pi.PRICE,
    pi.SIZE
  FROM PRODUCT_SET_ITEM psi
  JOIN PRODUCT_INFO pi ON psi.PRODUCT_CODE = pi.PRODUCT_CODE
  WHERE psi.SET_ID = ?
  <sql:param value="${setId}" />
</sql:query>

<c:set var="set" value="${setDetail.rows[0]}" />

<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<TITLE>セット商品詳細</TITLE>
<STYLE type="text/css">
body {background-color:white;}
.header {background-color:#333333; color:white; padding:10px; text-align:center;}
.header a {color:white; text-decoration:none; margin:0 10px;}
table {border-collapse:separate; border-spacing:2px; width:100%;}
th {background-color:#333333; text-align:center; font-size:large; font-weight:bold; color:white;}
td {background-color:#EFEFEF; font-size:normal; color:black;}
img {vertical-align: middle; max-width: 300px;}
.detail-box {border: 1px solid #ccc; padding: 10px; margin: 10px 0;}
input, select {padding: 5px;}
button {background-color:#333333; color:white; padding:10px 20px; cursor:pointer; border:none; margin:5px;}
button:hover {background-color:#555555;}
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
	<CENTER>
		<FORM action="cart.jsp" method="POST">

			<H2>セット商品詳細</H2>

			<c:if test="${not empty set}">

				<div class="detail-box">
					<H3>${set.SET_NAME}</H3>

					<img src="image/${set.SET_IMAGE}" /><BR><BR>

					価格：<B>${set.SET_PRICE}円</B><BR>
					セット詳細：${set.SET_DETAIL}<BR>
					カテゴリー：${set.CATEGORY_NAME}<BR>
					メーカー：${set.MAKER_NAME}<BR>
					素材：${set.MATERIAL}<BR>
					サイズ：${set.SIZE}<BR><BR>

					在庫：
					<c:choose>
						<c:when test="${set.STOCK_NUM > 0}">
							在庫あり
						</c:when>
						<c:otherwise>
							<B style="color:red;">在庫なし</B>
						</c:otherwise>
					</c:choose>
					<BR><BR>
				</div>

				<H4>セットに含まれる商品</H4>
				<TABLE border="1">
					<TR>
						<TH>商品コード</TH>
						<TH>商品名</TH>
						<TH>数量</TH>
						<TH>価格</TH>
						<TH>サイズ</TH>
					</TR>
					<c:forEach var="item" items="${setItems.rows}">
						<TR>
							<TD>${item.PRODUCT_CODE}</TD>
							<TD>${item.PRODUCT_NAME}</TD>
							<TD>${item.QUANTITY}</TD>
							<TD>${item.PRICE}円</TD>
							<TD>${item.SIZE}</TD>
						</TR>
					</c:forEach>
				</TABLE>

				<c:if test="${set.STOCK_NUM > 0}">
					<BR><BR>
					<TABLE border="1">
						<TR>
							<TD>サイズ</TD>
							<TD>
								<select name="size">
									<option value="">--選択してください--</option>
									<option value="S">S</option>
									<option value="M">M</option>
									<option value="L">L</option>
									<option value="XL">XL</option>
								</select>
							</TD>
						</TR>
						<TR>
							<TD>数量</TD>
							<TD>
								<select name="quantity">
									<c:forEach var="i" begin="1" end="${set.STOCK_NUM}">
										<option value="${i}">${i}</option>
									</c:forEach>
								</select>
							</TD>
						</TR>
					</TABLE>
					<BR>

					<input type="hidden" name="setId" value="${set.SET_ID}">
					<input type="hidden" name="setName" value="${set.SET_NAME}">
					<input type="hidden" name="price" value="${set.SET_PRICE}">

					<button type="submit">カートに追加</button>
				</c:if>

			</c:if>

			<c:if test="${empty set}">
				<P>セット商品が見つかりません</P>
			</c:if>

			<BR>
			<button type="button" onclick="history.back();">戻る</button>

		</FORM>
	</CENTER>
</BODY>
</HTML>
