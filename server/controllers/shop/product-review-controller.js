const Order = require("../../models/Order");
const Product = require("../../models/Product");
const ProductReview = require("../../models/Review");


// Review system with atomic updates
const addProductReview = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      const { productId, reviewMessage, reviewValue } = req.body;
      const { id: userId } = req.user;

      // Check if user can review (existing logic)
      const order = await Order.findOne({
        userId,
        "cartItems.productId": productId,
        orderStatus: { $in: ["confirmed", "delivered"] },
      }).session(session);

      if (!order) {
        throw new Error("You need to purchase product to review it");
      }

      // Check for existing review
      const existingReview = await ProductReview.findOne({
        productId,
        userId,
      }).session(session);

      if (existingReview) {
        throw new Error("You already reviewed this product");
      }

      // Create review
      const newReview = new ProductReview({
        productId,
        userId,
        reviewMessage,
        reviewValue,
      });
      await newReview.save({ session });

      // Update product average review atomically
      const pipeline = [
        { $match: { productId: mongoose.Types.ObjectId(productId) } },
        {
          $group: {
            _id: null,
            averageReview: { $avg: "$reviewValue" },
            totalReviews: { $sum: 1 }
          }
        }
      ];

      const result = await ProductReview.aggregate(pipeline).session(session);
      
      if (result.length > 0) {
        await Product.findByIdAndUpdate(
          productId,
          { averageReview: result[0].averageReview },
          { session }
        );
      }
    });

    res.status(201).json({ success: true });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  } finally {
    await session.endSession();
  }
};


// const addProductReview = async (req, res) => {
//   try {
//     const { productId, reviewMessage, reviewValue } = req.body;
//     const { id: userId, userName } = req.user;

//     const order = await Order.findOne({
//       userId,
//       "cartItems.productId": productId,
//       orderStatus: { $in: ["confirmed", "delivered"] },
//     });

//     if (!order) {
//       return res.status(403).json({
//         success: false,
//         message: "You need to purchase product to review it.",
//       });
//     }

//     const checkExistinfReview = await ProductReview.findOne({
//       productId,
//       userId,
//     });

//     if (checkExistinfReview) {
//       return res.status(400).json({
//         success: false,
//         message: "You already reviewed this product!",
//       });
//     }

//     const newReview = new ProductReview({
//       productId,
//       userId,
//       userName,
//       reviewMessage,
//       reviewValue,
//     });

//     await newReview.save();

//     const reviews = await ProductReview.find({ productId });
//     const totalReviewsLength = reviews.length;
//     const averageReview =
//       reviews.reduce((sum, reviewItem) => sum + reviewItem.reviewValue, 0) /
//       totalReviewsLength;

//     await Product.findByIdAndUpdate(productId, { averageReview });

//     res.status(201).json({
//       success: true,
//       data: newReview,
//     });
//   } catch (e) {
//     console.log(e);
//     res.status(500).json({
//       success: false,
//       message: "Error",
//     });
//   }
// };

const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;

    const reviews = await ProductReview.find({ productId });
    res.status(200).json({
      success: true,
      data: reviews,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Error",
    });
  }
};

module.exports = { addProductReview, getProductReviews };
