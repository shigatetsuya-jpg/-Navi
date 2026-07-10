<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8" %>
<%@ taglib prefix="c" uri="jakarta.tags.core" %>
<%@ taglib prefix="sql" uri="jakarta.tags.sql" %>

<%
    String sessionId = session.getId();
    String customerName = request.getParameter("customerName");
    String phone = request.getParameter("phone");
    String deliveryAddress = request.getParameter("deliveryAddress");
    String paymentMethod = request.getParameter("paymentMethod");
    String total = request.getParameter("total");

    boolean orderSuccess = false;
    String errorMessage = "";

    if (customerName != null && !customerName.isEmpty()) {
        try {
            org.h2.jdbcx.JdbcDataSource dataSource = new org.h2.jdbcx.JdbcDataSource();
            dataSource.setURL("jdbc:h2:~/h2db/mydb");
            dataSource.setUser("sa");
            dataSource.setPassword("");

            java.sql.Connection conn = dataSource.getConnection();

            int totalAmount = 0;
            if (total != null && !total.isEmpty()) {
                totalAmount = Integer.parseInt(total);
            }

            String insertOrderSQL = "INSERT INTO PURCHASE_ORDER (CUSTOMER_NAME, PHONE, ADDRESS, PAYMENT_METHOD, TOTAL_AMOUNT, ORDER_STATUS, ORDER_DATE) " +
                                   "VALUES (?, ?, ?, ?, ?, '未発送', CURRENT_TIMESTAMP)";
            java.sql.PreparedStatement pstmtOrder = conn.prepareStatement(insertOrderSQL);
            pstmtOrder.setString(1, customerName);
            pstmtOrder.setString(2, phone);
            pstmtOrder.setString(3, deliveryAddress);
            pstmtOrder.setString(4, paymentMethod);
            pstmtOrder.setInt(5, totalAmount);
            pstmtOrder.executeUpdate();
            pstmtOrder.close();

            String getCartItems = "SELECT PRODUCT_CODE, QUANTITY FROM SHOPPING_CART WHERE SESSION_ID = ?";
            java.sql.PreparedStatement pstmtGetItems = conn.prepareStatement(getCartItems);
            pstmtGetItems.setString(1, sessionId);
            java.sql.ResultSet rsItems = pstmtGetItems.executeQuery();

            while (rsItems.next()) {
                String productCode = rsItems.getString("PRODUCT_CODE");
                int quantity = rsItems.getInt("QUANTITY");

                String setIdStr = productCode.replace("SET-", "");
                int setId = Integer.parseInt(setIdStr);

                String updateStockSQL = "UPDATE PRODUCT_SET_STOCK SET STOCK_NUM = STOCK_NUM - ? WHERE SET_ID = ?";
                java.sql.PreparedStatement pstmtUpdateStock = conn.prepareStatement(updateStockSQL);
                pstmtUpdateStock.setInt(1, quantity);
                pstmtUpdateStock.setInt(2, setId);
                pstmtUpdateStock.executeUpdate();
                pstmtUpdateStock.close();
            }
            rsItems.close();
            pstmtGetItems.close();

            String deleteCartSQL = "DELETE FROM SHOPPING_CART WHERE SESSION_ID = ?";
            java.sql.PreparedStatement pstmtDeleteCart = conn.prepareStatement(deleteCartSQL);
            pstmtDeleteCart.setString(1, sessionId);
            pstmtDeleteCart.executeUpdate();
            pstmtDeleteCart.close();

            conn.close();
            orderSuccess = true;
        } catch (Exception e) {
            errorMessage = "エラーが発生しました: " + e.getMessage();
            e.printStackTrace();
        }
    }
%>

<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>MIND/STYLE - 注文完了</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
        .header { background: #333; color: white; padding: 20px; text-align: center; }
        .header h2 { margin: 0; }
        .header a { color: white; margin: 0 15px; text-decoration: none; }
        .header a:hover { text-decoration: underline; }
        .container { padding: 20px; max-width: 600px; margin: 0 auto; }
        .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; margin: 15px 0; }
        .error { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 15px; margin: 15px 0; }
        .order-details { background: #f9f9f9; border: 1px solid #ddd; padding: 15px; margin: 15px 0; }
        button { padding: 10px 20px; background: #4CAF50; color: white; border: none; cursor: pointer; font-size: 16px; margin-top: 15px; }
        button:hover { background: #45a049; }
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
    <h2>注文完了</h2>

    <% if (orderSuccess) { %>
        <div class="success">
            <h3>ご注文ありがとうございます！</h3>
            <p>注文が正常に完了しました。</p>
        </div>

        <div class="order-details">
            <h4>ご注文内容</h4>
            <p><strong>お客様名:</strong> <%= customerName %></p>
            <p><strong>電話番号:</strong> <%= phone %></p>
            <p><strong>配送先住所:</strong> <%= deliveryAddress %></p>
            <p><strong>支払い方法:</strong> <%= paymentMethod %></p>
        </div>

        <form action="list4.jsp" method="GET">
            <button type="submit">商品一覧に戻る</button>
        </form>
    <% } else { %>
        <div class="error">
            <h3>エラーが発生しました</h3>
            <p><%= errorMessage %></p>
        </div>
        <button type="button" onclick="history.back()">戻る</button>
    <% } %>
</div>

</body>
</html>
