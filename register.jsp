<%@ page language="java" contentType="text/html; charset=utf-8"
	pageEncoding="utf-8"%>
<!DOCTYPE html>
<%@ taglib prefix="c" uri="jakarta.tags.core" %>
<%@ taglib prefix="sql" uri="jakarta.tags.sql" %>
<%@ taglib prefix="fmt" uri="jakarta.tags.fmt" %>
<%@ taglib prefix="fn" uri="jakarta.tags.functions"%>

<sql:setDataSource driver="org.h2.Driver" url="jdbc:h2:~/h2db/mydb" />

<%
  String action = request.getParameter("action");
  if ("register".equals(action)) {
    String customerName = request.getParameter("customerName");
    String email = request.getParameter("email");
    String password = request.getParameter("password");
    String address = request.getParameter("address");
    String phone = request.getParameter("phone");
%>
    <sql:update>
      INSERT INTO CUSTOMER_MEMBER (CUSTOMER_NAME, EMAIL, PASSWORD, ADDRESS, PHONE)
      VALUES (?, ?, ?, ?, ?)
      <sql:param value="<%= customerName %>" />
      <sql:param value="<%= email %>" />
      <sql:param value="<%= password %>" />
      <sql:param value="<%= address %>" />
      <sql:param value="<%= phone %>" />
    </sql:update>
    <script>
      alert("会員登録が完了しました。");
      location.href = "list4.jsp";
    </script>
<%
  }
%>

<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<TITLE>会員登録</TITLE>
<STYLE type="text/css">
body {background-color:white;}
.header {background-color:#333333; color:white; padding:10px; text-align:center;}
.header a {color:white; text-decoration:none; margin:0 10px;}
table {border-collapse:separate; border-spacing:2px; width:100%;}
th {background-color:#333333; text-align:center; font-size:large; font-weight:bold; color:white;}
td {background-color:#EFEFEF; font-size:normal; color:black;}
input {width:100%; padding:5px; box-sizing:border-box;}
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
		<FORM action="register.jsp" method="POST">
			<input type="hidden" name="action" value="register">

			<H2>会員登録</H2>

			<TABLE border="1">
				<TR>
					<TD>氏名 *</TD>
					<TD><input type="text" name="customerName" required></TD>
				</TR>
				<TR>
					<TD>メールアドレス *</TD>
					<TD><input type="email" name="email" required></TD>
				</TR>
				<TR>
					<TD>パスワード *</TD>
					<TD><input type="password" name="password" required></TD>
				</TR>
				<TR>
					<TD>住所</TD>
					<TD><input type="text" name="address"></TD>
				</TR>
				<TR>
					<TD>電話番号</TD>
					<TD><input type="tel" name="phone"></TD>
				</TR>
			</TABLE>

			<BR>
			<button type="submit">登録する</button>
			<button type="reset">クリア</button>
			<BR><BR>
			<a href="list4.jsp">戻る</a>
		</FORM>
	</CENTER>
</BODY>
</HTML>
