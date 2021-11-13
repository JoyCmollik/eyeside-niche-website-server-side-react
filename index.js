/* 
Project Name: eyeSide
Project Author: Joy Chandra Mollik
Project Start Date: 11/10/2021
Project Type: Traveling and Tourism
 */

// dependencies
const express = require('express');
const { MongoClient } = require('mongodb');
const ObjectId = require('mongodb').ObjectId;
const port = process.env.PORT || 5000;
const app = express();
const cors = require('cors');
require('dotenv').config();

// eyeside-firebase-adminsdk.json
var admin = require('firebase-admin');

var serviceAccount = require('./eyeside-firebase-adminsdk.json');

admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
});

// middleware
app.use(cors());
app.use(express.json());

console.log(process.env.DB_USER);

// mongodb initialization
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6vvik.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
});

// middleware for token verification
async function verifyToken(req, res, next) {
	if (req?.headers?.authorization?.startsWith('Bearer ')) {
		const token = req.headers.authorization.split(' ')[1];

		try {
			const decodedUser = await admin.auth().verifyIdToken(token);
			req.decodedEmail = decodedUser.email;
		} finally {
		}
	}

	next();
}

async function run() {
	try {
		client.connect();

		// initializing database & collections
		const database = client.db('eyeSide');
		const userCollection = database.collection('users');
		const productCollection = database.collection('products');
		const orderCollection = database.collection('orders');
		const reviewCollection = database.collection('reviews');

		// users CRUD //

		// sending query result if email contains role:admin
		app.get('/user/:email', async (req, res) => {
			const email = req.params.email;

			const query = { email: email };
			const user = await userCollection.findOne(query);

			let isAdmin = false;

			if (user?.role === 'admin') {
				isAdmin = true;
			}

			res.json({ admin: isAdmin });
		});

		// sending products
		app.get('/products', async (req, res) => {
			const size = parseInt(req.query.size);
			const cursor = productCollection.find({});

			let products;

			if (size) {
				products = await cursor.limit(size).toArray();
			} else {
				products = await cursor.toArray();
			}

			res.json(products);
		});

		// sending single product
		app.get('/product/:_id', async (req, res) => {
			const _id = req.params._id;

			const query = { _id: ObjectId(_id) };

			const product = await productCollection.findOne(query);

			res.json(product);
		});

		// sending client orders
		app.get('/myorders/:uid', async (req, res) => {
			const uid = req.params.uid;
			const query = { 'user.user_uid': uid };
			const cursor = orderCollection.find(query);
			const myOrders = await cursor.toArray();

			res.json(myOrders);
		});

		// sending all reviews
		app.get('/reviews', async (req, res) => {
			const cursor = reviewCollection.find();

			const reviews = await cursor.toArray();
			res.json(reviews);
		});

		// storing user orders
		app.post('/placeorder', async (req, res) => {
			const order = req.body;

			const result = await orderCollection.insertOne(order);

			res.json(result);
		});

		//storing new registered user
		app.post('/adduser', async (req, res) => {
			const newUser = req.body;

			const result = await userCollection.insertOne(newUser);
			res.json(result);
		});

		// storing new review from users
		app.post('/addreview', verifyToken, async (req, res) => {
			const newReview = req.body;

			const result = await reviewCollection.insertOne(newReview);
			res.json(result);
		});

		// storing user signed in with google
		app.put('/adduser', async (req, res) => {
			const user = req.body;

			const filter = { email: user.email };
			const options = { upsert: true };
			const updateUser = { $set: user };
			const result = await userCollection.updateOne(
				filter,
				updateUser,
				options
			);

			res.json(result);
		});

		// admins CRUD //

		// sending all of the orders
		app.get('/admin/orders', verifyToken, async (req, res) => {
			const cursor = orderCollection.find();

			const orders = await cursor.toArray();

			res.json(orders);
		});

		// adding new product in the products collection
		app.post('/admin/addproduct', verifyToken, async (req, res) => {
			const product = req.body;

			const result = await productCollection.insertOne(product);
			res.json(result);
		});

		// updating status of the orders
		app.put('/admin/status/:_id', verifyToken, async (req, res) => {
			const status = req.body.status;
			const _id = req.params._id;

			const filter = { _id: ObjectId(_id) };

			const updateOrder = {
				$set: {
					order_status: status,
				},
			};

			const result = await orderCollection.updateOne(filter, updateOrder);

			res.json(result);
		});

		// making admin if user exists
		app.put('/admin/addadmin', verifyToken, async (req, res) => {
			const user = req.body;
			const requesterEmail = req.decodedEmail;
			console.log(requesterEmail);

			// checking if email exists on the database
			if (requesterEmail) {
				const requesterAccount = await userCollection.findOne({
					email: requesterEmail,
				});

				// checking if the email has role admin
				if (requesterAccount.role === 'admin') {
					const filter = { email: user.email };
					const updateUser = { $set: { role: 'admin' } };
					const result = await userCollection.updateOne(
						filter,
						updateUser
					);
					res.json(result);
				}
			} else {
				// default response
				res.status(403).json({
					message: 'You do not have the access to request',
				});
			}
		});

		// deleting a single order
		app.delete('/admin/order/:_id', async (req, res) => {
			const _id = req.params._id;

			const query = { _id: ObjectId(_id) };

			const result = await orderCollection.deleteOne(query);

			res.json(result);
		});
	} finally {
		await client.close();
	}
}

run().catch(console.dir);

// testing
app.get('/', (req, res) => {
	res.send('Server is running fine');
});

app.listen(port, () => {
	console.log('[RUNNING] server on port: ', port);
});
