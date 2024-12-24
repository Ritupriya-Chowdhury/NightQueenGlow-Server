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
  }
});



// Middleware
app.use(cors({
  origin: ['http://localhost:5173'], 
  credentials: true
}));
app.use(express.json());





// VerifyJWT
const verifyJWT = (req, res, next) => {
  const token = req.headers.authorization; 
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
    const database = client.db("NightQueenGlow");

    // Collections
    const products = database.collection("products");
    const user = database.collection("user");


    // Verify Admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }
    // Verify Seller
    const verifySeller = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'seller') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }

    // Get all products
    // Get products with search, filter, and sort functionality
app.get('/products', async (req, res) => {
  try {
    const { name, category, sort } = req.query;

    // Build the query object
    const query = {};
    if (name) {
      query.name = { $regex: name, $options: 'i' }; // Case-insensitive search
    }
    if (category) {
      query.category = category;
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
    app.post('/products',  async (req, res) => {
    
      try {
        const product = req.body;
        const result = await products.insertOne(product);
        console.log(result);
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: true, message: 'Failed to add product' });
      }
    });

    // Create user route
    app.post('/users', async (req, res) => {
        try {
          const { name, email, role = 'buyer' } = req.body;
  
          // Check if the email already exists
          const existingUser = await user.findOne({ email });
          if (existingUser) {
            return res.status(400).send({ error: true, message: 'Email already exists' });
          }
  
          // Insert user data into the database
          const newUser = { name, email, role };
          const result = await user.insertOne(newUser);
  
          res.send({ success: true, message: 'User created successfully', userId: result.insertedId });
        } catch (error) {
          res.status(500).send({ error: true, message: 'Failed to create user' });
        }
      });
  
    } catch (error) {
      console.error(error);
    }


     // JWT API
     app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_ACCESS_SECRET, { expiresIn: '1h' })

      res.send({ token })
    })

    
   


  }
  run().catch(console.dir);
// Server Check Route
app.get('/', (req, res) => {
  res.send('NightQueenGlow Server is running');
});

app.listen(port, () => {
  console.log(`NightQueenGlow Server is running port:http://localhost:${port}`);
});
