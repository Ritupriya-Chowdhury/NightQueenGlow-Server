const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 1830;
const { ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

// MongoDB Client
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = process.env.DATABASE_URL;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Verify JWT
const verifyJWT = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]; // Extract token from "Bearer <token>"
  if (!token) {
    return res.status(401).send({ error: true, message: 'Unauthorized access' });
  }

  jwt.verify(token, process.env.JWT_ACCESS_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'Unauthorized access' });
    }
    req.decoded = decoded;
    next();
  });
};

async function run() {
  try {
    await client.connect();
    const database = client.db('NightQueenGlow');

    // Collections
    const products = database.collection('products');
    const users = database.collection('user');

    // Verify Admin Middleware
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await users.findOne({ email });
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'Forbidden access' });
      }
      next();
    };

    // Verify Seller Middleware
    const verifySeller = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await users.findOne({ email });
      if (user?.role !== 'seller') {
        return res.status(403).send({ error: true, message: 'Forbidden access' });
      }
      next();
    };

    // Get products with search, filter, and sort functionality
    app.get('/products', async (req, res) => {
      try {
        const { name, category, sort, minPrice, maxPrice } = req.query;

        // Build the query object
        const query = {};
        if (name) {
          query.name = { $regex: name, $options: 'i' }; // Case-insensitive search
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
        if (sort === 'asc') {
          sortCriteria.price = 1; // Sort by price ascending
        } else if (sort === 'desc') {
          sortCriteria.price = -1; // Sort by price descending
        }

        // Fetch data with query and sort
        const result = await products.find(query).sort(sortCriteria).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: true, message: 'Failed to fetch products' });
      }
    });

    // Add a product (Seller only)
    app.post('/products', verifyJWT, verifySeller, async (req, res) => {
      try {
        const product = req.body;
        const result = await products.insertOne(product);
        res.send({ success: true, result });
      } catch (error) {
        res.status(500).send({ error: true, message: 'Failed to add product' });
      }
    });

    // Create a new user
    app.post('/users', async (req, res) => {
      try {
        const { name, email, role = 'buyer', whishList = [] } = req.body;

        // Check if the email already exists
        const existingUser = await users.findOne({ email });
        if (existingUser) {
          return res.status(400).send({ error: true, message: 'Email already exists' });
        }

        // Insert user data into the database
        const newUser = { name, email, role, whishList };
        const result = await users.insertOne(newUser);

        res.send({ success: true, message: 'User created successfully', userId: result.insertedId });
      } catch (error) {
        res.status(500).send({ error: true, message: 'Failed to create user' });
      }
    });

    // JWT API
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_ACCESS_SECRET, { expiresIn: '1h' });
      res.send({ token });
    });
  } catch (error) {
    console.error(error);
  }
}

run().catch(console.dir);

// Server Check Route
app.get('/', (req, res) => {
  res.send('NightQueenGlow Server is running');
});

app.listen(port, () => {
  console.log(`NightQueenGlow Server is running at: http://localhost:${port}`);
});
