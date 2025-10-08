// const capturePayment = async (req, res) => {
//   try {
//     const { paymentId, payerId, orderId } = req.body;

//     let order = await Order.findById(orderId);

//     if (!order) {
//       return res.status(404).json({
//         success: false,
//         message: "Order cannot be found",
//       });
//     }

//     order.paymentStatus = "paid";
//     order.orderStatus = "confirmed";
//     order.paymentId = paymentId;
//     order.payerId = payerId;

//     for (let item of order.cartItems) {
//       let product = await Product.findById(item.productId);

//       if (!product) {
//         return res.status(404).json({
//           success: false,
//           message: `Not enough stock for this product ${item.title}`,
//         });
//       }

//       product.totalStock -= item.quantity;

//       await product.save();
//     }

//     const getCartId = order.cartId;
//     await Cart.findByIdAndDelete(getCartId);

//     await order.save();

    
//   } catch (e) {
//     console.log(e);
//     res.status(500).json({
//       success: false,
//       message: "Some error occurred!",
//     });
//   }
// };

// Payment capture with transactions
const capturePayment = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      const { paymentId, payerId, orderId } = req.body;

      // 1. Lock and validate order
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        throw new Error("Order not found");
      }

      // 2. Check stock availability atomically
      for (let item of order.cartItems) {
        const product = await Product.findById(item.productId).session(session);
        
        if (!product || product.totalStock < item.quantity) {
          throw new Error(`Insufficient stock for ${item.title}`);
        }
      }

      // 3. Update stock atomically
      for (let item of order.cartItems) {
        await Product.findByIdAndUpdate(
          item.productId,
          { $inc: { totalStock: -item.quantity } },
          { session }
        );
      }

      // 4. Update order status
      order.paymentStatus = "paid";
      order.orderStatus = "confirmed";
      order.paymentId = paymentId;
      order.payerId = payerId;
      await order.save({ session });

      // 5. Delete cart
      await Cart.findByIdAndDelete(order.cartId, { session });
    });

    res.status(200).json({
      success: true,
      message: "Order confirmed"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  } finally {
    await session.endSession();
  }
};

export default capturePayment;