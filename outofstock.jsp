<%@ page language="java" contentType="text/html; charset=utf-8"
	pageEncoding="utf-8"%>
<!DOCTYPE html>
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
.container {padding:20px; max-width:600px; margin:0 auto; text-align:center;}
.message-box {background-color:#f8d7da; border:1px solid #f5c6cb; color:#721c24; padding:30px; margin:40px 0; border-radius:8px; font-size:18px;}
button {padding:12px 24px; border:none; cursor:pointer; font-size:16px; margin:5px; border-radius:4px;}
.back-button {background-color:#333333; color:white;}
.back-button:hover {background-color:#555555;}
.end-button {background-color:#cc0000; color:white;}
.end-button:hover {background-color:#990000;}
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
		<div class="message-box">
			※ご指定いただいた商品は、ただいま在庫がございません。
		</div>

		<a href="list4.jsp"><button type="button" class="back-button">商品選択画面に戻る</button></a>
		<a href="cart.jsp"><button type="button" class="end-button">カートを確認する</button></a>
	</div>

</BODY>
</HTML>
