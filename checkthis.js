const paypal = require("../../helpers/paypal");
const Order = require("../../models/Order");
const Cart = require("../../models/Cart");
const Product = require("../../models/Product");
// const capturePayments= require("./capturePayment-controller")
const createOrder = async (req, res) => {
  try {
    const {
      userId,
      cartItems,
      addressInfo,
      orderStatus,
      paymentMethod,
      paymentStatus,
      totalAmount,
      orderDate,
      orderUpdateDate,
      paymentId,
      payerId,
      cartId,
    } = req.body;

    const create_payment_json = {
      intent: "sale",
      payer: {
        payment_method: "paypal",
      },
      redirect_urls: {
        return_url: "http://localhost:5173/shop/paypal-return",
        cancel_url: "http://localhost:5173/shop/paypal-cancel",
      },
      transactions: [
        {
          item_list: {
            items: cartItems.map((item) => ({
              name: item.title,
              sku: item.productId,
              price: item.price.toFixed(2),
              currency: "USD",
              quantity: item.quantity,
            })),
          },
          amount: {
            currency: "USD",
            total: totalAmount.toFixed(2),
          },
          description: "description",
        },
      ],
    };

    paypal.payment.create(create_payment_json, async (error, paymentInfo) => {
      if (error) {
        console.log(error);

        return res.status(500).json({
          success: false,
          message: "Error while creating paypal payment",
        });
      } else {
        const newlyCreatedOrder = new Order({
          userId,
          cartId,
          cartItems,
          addressInfo,
          orderStatus,
          paymentMethod,
          paymentStatus,
          totalAmount,
          orderDate,
          orderUpdateDate,
          paymentId,
          payerId,
        });

        await newlyCreatedOrder.save();

        const approvalURL = paymentInfo.links.find(
          (link) => link.rel === "approval_url"
        ).href;

        res.status(201).json({
          success: true,
          approvalURL,
          orderId: newlyCreatedOrder._id,
        });
      }
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Some error occured!",
    });
  }
};


const getAllOrdersByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const orders = await Order.find({ userId });

    if (!orders.length) {
      return res.status(404).json({
        success: false,
        message: "No orders found!",
      });
    }

    res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Some error occured!",
    });
  }
};

const getOrderDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found!",
      });
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Some error occured!",
    });
  }
};

const capturePayment = async (req, res) => {
  try {
    const { paymentId, payerId, orderId } = req.body;

    let order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    order.paymentStatus = "paid";
    order.orderStatus = "confirmed";
    order.paymentId = paymentId;
    order.payerId = payerId;

    for (let item of order.cartItems) {
      let product = await Product.findById(item.productId);

      if (!product || product.totalStock < item.quantity) {
        return res.status(404).json({
          success: false,
          message: `Not enough stock for the product ${item.title}`,
        });
      }

      product.totalStock -= item.quantity;
      await product.save();
    }

    const getCartId = order.cartId;
    await Cart.findByIdAndDelete(getCartId);

    await order.save();

    // Integrate email functionality here
    sendOrderConfirmationEmail(order.userId, order); // Add email-sending logic

    res.status(200).json({
      success: true,
      message: "Order confirmed",
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
const User = require("../../models/User"); // Import the User model

const getUserDetails = async (userId) => {
  try {
    const user = await User.findById(userId); // Replace with your user-fetching logic
    return user;
  } catch (error) {
    console.error("Error fetching user details:", error);
    throw new Error("Failed to fetch user details");
  }
};

const nodemailer = require("nodemailer");

const sendEmail = async (to, subject, content) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail", // or your email provider
      auth: {
        user: "your-email@gmail.com", // Replace with your email
        pass: "your-email-password", // Replace with your email password or app-specific password
      },
    });

    const mailOptions = {
      from: "your-email@gmail.com", // Sender address
      to, // Receiver email
      subject, // Subject line
      html: content, // Email content in HTML
    };

    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Failed to send email");
  }
};


// Helper function for sending confirmation emails
const sendOrderConfirmationEmail = async (userId, order) => {
  const user = await getUserDetails(userId); // Add logic to fetch user details like email
  if (user) {
    // Email sending logic (e.g., using nodemailer)
    const emailContent = `
      Hi ${user.name},
      Thank you for your order!
      Order Details:
      Order ID: ${order._id}
      Items: ${order.cartItems.map((item) => item.name).join(", ")}
      Total: $${order.totalAmount.toFixed(2)}
      We appreciate your business.
    `;
    await sendEmail(user.email, "Order Confirmation", emailContent); // Add your email utility here
  }
};

module.exports = {
  createOrder,
  capturePayment,
  getAllOrdersByUser,
  getOrderDetails,
};
