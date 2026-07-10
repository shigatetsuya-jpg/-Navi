<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8" %>

<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>MIND/STYLE - 購入情報入力</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
        .header { background: #333; color: white; padding: 20px; text-align: center; }
        .header h2 { margin: 0; }
        .header a { color: white; margin: 0 15px; text-decoration: none; }
        .header a:hover { text-decoration: underline; }
        .container { padding: 20px; max-width: 600px; margin: 0 auto; }
        .form-group { margin: 15px 0; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input, select, textarea { width: 100%; padding: 8px; box-sizing: border-box; }
        textarea { height: 100px; }
        button { padding: 10px 20px; background: #4CAF50; color: white; border: none; cursor: pointer; font-size: 16px; margin-top: 15px; margin-right: 10px; }
        button:hover { background: #45a049; }
        .total-section { background: #f0f0f0; padding: 15px; margin: 15px 0; font-weight: bold; font-size: 18px; }
    </style>
</head>
<body>

<div class="header">
    <h2>MIND/STYLE</h2>
    <a href="list4.jsp">一覧</a>
    <a href="search.jsp">検索</a>
    <a href="cart.jsp">カート</a>
</div>

<div class="container">
    <h2>購入情報入力</h2>

    <%
        String total = request.getParameter("total");
        if (total == null || total.isEmpty()) {
            total = "0";
        }
    %>

    <div class="total-section">
        お支払い総額: <%= total %>円
    </div>

    <form action="orderComplete.jsp" method="POST">
        <input type="hidden" name="total" value="<%= total %>">

        <div class="form-group">
            <label for="customerName">お名前 *</label>
            <input type="text" id="customerName" name="customerName" required>
        </div>

        <div class="form-group">
            <label for="phone">電話番号 *</label>
            <input type="tel" id="phone" name="phone" required>
        </div>

        <div class="form-group">
            <label for="deliveryAddress">配送先住所 *</label>
            <textarea id="deliveryAddress" name="deliveryAddress" required></textarea>
        </div>

        <div class="form-group">
            <label for="paymentMethod">支払い方法 *</label>
            <select id="paymentMethod" name="paymentMethod" required>
                <option value="">選択してください</option>
                <option value="クレジットカード">クレジットカード</option>
                <option value="銀行振込">銀行振込</option>
                <option value="代引き">代引き</option>
            </select>
        </div>

        <button type="submit">注文確定</button>
        <button type="button" onclick="history.back()">戻る</button>
    </form>
</div>

</body>
</html>
