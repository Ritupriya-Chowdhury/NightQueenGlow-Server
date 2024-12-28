const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 1830;
const { ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;

// Middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1]; // Extract token from "Bearer <token>"
  if (!token) {
    return res
      .status(401)
      .send({ error: true, message: "Unauthorized access" });
  }

  jwt.verify(token, JWT_ACCESS_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "Unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

// MongoDB Client Setup
const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = process.env.DATABASE_URL;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const database = client.db("NightQueenGlow");
    const products = database.collection("products");
    const users = database.collection("user");
    const carts = database.collection("carts");

    // Verify Admin Middleware
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await users.findOne({ email });
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden access" });
      }
      next();
    };

    // Verify Seller Middleware
    const verifySeller = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await users.findOne({ email });
      if (user?.role !== "seller") {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden access" });
      }
      next();
    };

    // Verify Buyer Middleware
    const verifyBuyer = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await users.findOne({ email });
      if (user?.role !== "buyer") {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden access" });
      }
      next();
    };

    // Get products with search, filter, and sort functionality
    app.get("/products", async (req, res) => {
      try {
        const { name, category, sort, minPrice, maxPrice } = req.query;

        // Build the query object
        const query = {};
        if (name) {
          query.name = { $regex: name, $options: "i" }; // Case-insensitive search
        }
        if (category) {
          query.category = category;
        }
        if (minPrice || maxPrice) {
          query.price = {};
          if (minPrice) query.price.$gte = parseFloat(minPrice);
          if (maxPrice) query.price.$lte = parseFloat(maxPrice);
        }

        // Determine sorting criteria
        const sortCriteria = {};
        if (sort === "asc") {
          sortCriteria.price = 1; // Sort by price ascending
        } else if (sort === "desc") {
          sortCriteria.price = -1; // Sort by price descending
        }

        // Fetch data with query and sort
        const result = await products.find(query).sort(sortCriteria).toArray();
        res.send(result);
      } catch (error) {
        res
          .status(500)
          .send({ error: true, message: "Failed to fetch products" });
      }
    });

    // Get product by ID
    app.get("/products/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const product = await products.findOne({ _id: new ObjectId(id) });

        if (!product) {
          return res
            .status(404)
            .send({ error: true, message: "Product not found" });
        }
        res.send(product);
      } catch (error) {
        res
          .status(500)
          .send({ error: true, message: "Failed to fetch product" });
      }
    });

    // Add a product (Seller only)
    app.post("/products", verifyJWT, verifySeller, async (req, res) => {
      try {
        const product = req.body;
        const result = await products.insertOne(product);
        res.send({ success: true, result });
      } catch (error) {
        res.status(500).send({ error: true, message: "Failed to add product" });
      }
    });

    // Create a new user
    app.post("/users", async (req, res) => {
      try {
        const email = req.body.email;
        const existingUser = await users.findOne({ email });

        if (existingUser) {
          return res
            .status(400)
            .send({ error: true, message: "Email already exists" });
        }

        const newUser = {
          ...req.body,
          role: "buyer", // Default role
        };

        const result = await users.insertOne(newUser);
        res.send({
          success: true,
          message: "User created successfully",
          userId: result.insertedId,
        });
      } catch (error) {
        res.status(500).send({ error: true, message: "Failed to create user" });
      }
    });

    // Get users with optional query parameters
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const result = await users.find().toArray(); 
    
        if (!result || result.length === 0) {
          return res.status(404).send({ error: true, message: "No users found" });
        }
    
        res.status(200).send(result); // Explicitly set status 200 for success
      } catch (error) {
        console.error("Error fetching users:", error); // Log error for debugging
        res.status(500).send({ error: true, message: "Failed to fetch users" });
      }
    });
    

    // Update user role
    app.patch(
      "/users/update-role/:id",
      verifyJWT, 
      verifyAdmin,
      async (req, res) => {
        try {
          const userId = req.params.id; 
          const { role } = req.body;   
          // console.log(req.body.role )
         
          const existingUser = await users.findOne({ _id: new ObjectId(userId)});
        
          if (!existingUser) {
            return res.status(404).send({ error: true, message: "User not found" });
          }
    
        
          const result = await users.updateOne(
            { _id: new ObjectId(userId) },
            { $set: {role } }
          );
          console.log(result)
    
          res.send({ success: true, message: `User role updated to ${role}` });
        } catch (error) {
          console.error(error);
          res
            .status(500)
            .send({ error: true, message: "Failed to update user role" });
        }
      }
    );
    

    // Delete user by ID
    app.delete("/users/:id", verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const userId = req.params.id;

        const result = await users.deleteOne({ _id: new ObjectId(userId)});

        if (result.deletedCount === 0) {
          return res
            .status(404)
            .send({ error: true, message: "User not found" });
        }

        res.send({ success: true, message: "User deleted successfully" });
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: true, message: "Failed to delete user" });
      }
    });

    // Get a user by email
    app.get("/users/email/:email", verifyJWT, async (req, res) => {
      try {
        const email = req.params.email;
        console.log(email);
        const user = await users.findOne({ email });
        console.log(user);

        if (!user) {
          return res
            .status(404)
            .send({ error: true, message: "User not found" });
        }
        res.send(user);
      } catch (error) {
        res.status(500).send({ error: true, message: "Failed to fetch user" });
      }
    });

    // Add to Wishlist (Buyer only)
    app.post(
      "/wishlist/:productId",
      verifyJWT,
      verifyBuyer,
      async (req, res) => {
        try {
          const email = req.decoded.email; // Extract email from JWT
          const productId = req.params.productId;

          // Check if the product exists
          const product = await products.findOne({
            _id: new ObjectId(productId),
          });
          if (!product) {
            return res
              .status(404)
              .send({ error: true, message: "Product not found" });
          }

          // Add the product to the user's wishlist
          const result = await users.updateOne(
            { email },
            { $addToSet: { wishlist: product } } // Avoid duplicate entries
          );

          if (result.modifiedCount === 0) {
            return res
              .status(400)
              .send({ error: true, message: "Failed to add to wishlist" });
          }

          res.send({
            success: true,
            message: "Product added to wishlist successfully",
          });
        } catch (error) {
          res
            .status(500)
            .send({ error: true, message: "Failed to add to wishlist" });
        }
      }
    );

    // Remove from Wishlist (Buyer only)
    app.delete(
      "/wishlist/:productId",
      verifyJWT,
      verifyBuyer,
      async (req, res) => {
        try {
          const email = req.decoded.email; // Extract email from JWT
          const productId = req.params.productId;

          // Check if the product exists
          const product = await products.findOne({
            _id: new ObjectId(productId),
          });
          if (!product) {
            return res
              .status(404)
              .send({ error: true, message: "Product not found" });
          }

          // Remove the product from the user's wishlist
          const result = await users.updateOne(
            { email },
            { $pull: { wishlist: { _id: new ObjectId(productId) } } } // Remove the product from the wishlist
          );

          if (result.modifiedCount === 0) {
            return res
              .status(400)
              .send({ error: true, message: "Failed to remove from wishlist" });
          }

          res.send({
            success: true,
            message: "Product removed from wishlist successfully",
          });
        } catch (error) {
          res
            .status(500)
            .send({ error: true, message: "Failed to remove from wishlist" });
        }
      }
    );

    // Add to Cart (Buyer only)
    app.post("/cart/:productId", verifyJWT, verifyBuyer, async (req, res) => {
      try {
        const email = req.decoded.email; // Extract email from JWT
        const productId = req.params.productId;

        // Check if the product exists
        const product = await products.findOne({
          _id: new ObjectId(productId),
        });
        if (!product) {
          return res
            .status(404)
            .send({ error: true, message: "Product not found" });
        }
        if (product.quantity < 1) {
          return res
            .status(400)
            .send({ error: true, message: "Product out of stock" });
        }
        let userCart = await carts.findOne({ email });

        if (!userCart) {
          // If the cart does not exist, create a new cart
          userCart = {
            email,
            products: [
              {
                productId: new ObjectId(productId),
                name: product.name,
                quantity: 1,
                price: product.price,
                image: product.image,
              },
            ],
          };
          const result = await carts.insertOne(userCart);
          await products.updateOne(
            { _id: new ObjectId(productId) },
            { $inc: { quantity: -1 } } // Decrease stock quantity by 1
          );
          console.log(result);
        } else {
          // If the cart exists, update the cart by adding the product
          const productIndex = userCart.products.findIndex(
            (p) => p.productId.toString() === productId
          );

          if (productIndex === -1) {
            // Product does not exist in the cart, so add it
            userCart.products.push({
              productId: new ObjectId(productId),
              name: product.name,
              quantity: 1,
              price: product.price,
            });
            await products.updateOne(
              { _id: new ObjectId(productId) },
              { $inc: { quantity: -1 } } // Decrease stock quantity by 1
            );
          } else {
            // Product already in the cart, so increase the quantity by 1
            userCart.products[productIndex].quantity += 1;
            await products.updateOne(
              { _id: new ObjectId(productId) },
              { $inc: { quantity: -1 } } // Decrease stock quantity by 1
            );
          }

          await carts.updateOne(
            { email },
            { $set: { products: userCart.products } }
          );
        }

        res.send({
          success: true,
          message: "Product added to cart successfully",
        });
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .send({ error: true, message: "Failed to add product to cart" });
      }
    });
    // Get Cart (Buyer only)
    app.get("/cart", verifyJWT, verifyBuyer, async (req, res) => {
      try {
        const email = req.decoded.email; // Extract email from JWT
        const userCart = await carts.findOne({ email });

        if (!userCart) {
          return res
            .status(404)
            .send({ error: true, message: "Cart not found" });
        }

        res.send(userCart);
      } catch (error) {
        res.status(500).send({ error: true, message: "Failed to fetch cart" });
      }
    });

    // JWT API (Login Route)
    app.post("/jwt", (req, res) => {
      const user = req.body;
      // console.log(user)
      // Avoid logging sensitive information in production
      const token = jwt.sign({ email: user.email }, JWT_ACCESS_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });
  } catch (error) {
    console.error(error);
  }
}

// Server Check Route
app.get("/", (req, res) => {
  res.send("NightQueenGlow Server is running");
});

app.listen(port, () => {
  console.log(`NightQueenGlow Server is running at: http://localhost:${port}`);
});

run().catch(console.dir);
