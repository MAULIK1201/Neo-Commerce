const nodemailer = require("nodemailer");

const capturePayment = async (req, res) => {
  try {
    const { paymentId, payerId, orderId } = req.body;

    let order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order cannot be found",
      });
    }

    order.paymentStatus = "paid";
    order.orderStatus = "confirmed";
    order.paymentId = paymentId;
    order.payerId = payerId;

    for (let item of order.cartItems) {
      let product = await Product.findById(item.productId);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Not enough stock for this product ${item.title}`,
        });
      }

      product.totalStock -= item.quantity;

      await product.save();
    }

    const getCartId = order.cartId;
    await Cart.findByIdAndDelete(getCartId);

    await order.save();

    // Set up Nodemailer transporter
    const transporter = nodemailer.createTransport({
      service: "gmail", // You can use any email service like Outlook, Yahoo, etc.
      auth: {
        user: process.env.EMAIL_USER, // Replace with your email
        pass: process.env.EMAIL_PASS, // Replace with your email password or app password
      },
    });

    // Compose the email
    const mailOptions = {
      from: '"Your Shop" <your-email@gmail.com>', // Sender address
      to: order.addressInfo.email, // Recipient's email (from addressInfo)
      subject: "Order Confirmation", // Subject line
      text: `Dear ${order.addressInfo.name},\n\nYour order has been successfully placed! Order ID: ${orderId}.\n\nThank you for shopping with us!\n\nBest regards,\nYour Shop Team`,
      html: `
        <p>Dear ${order.addressInfo.name},</p>
        <p>Your order has been successfully placed!</p>
        <p><strong>Order ID:</strong> ${orderId}</p>
        <p>Thank you for shopping with us!</p>
        <p>Best regards,<br>Your Shop Team</p>
      `,
    };

    // Send the email
    await transporter.sendMail(mailOptions);

    res.status(200).json({
      success: true,
      message: "Order confirmed and email sent to the user.",
      data: order,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Some error occurred!",
    });
  }
};

export default capturePayment;