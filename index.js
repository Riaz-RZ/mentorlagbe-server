import express from 'express';
import cors from 'cors';
import 'dotenv/config'
import { MongoClient } from 'mongodb';

const app = express();

app.use(cors());
app.use(express.json());



const client = new MongoClient(process.env.DB_URI);
export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

const connectedClient = await connectToMongoDB();
const db = connectedClient.db('mentorlagbe'); 
const usersCollections = db.collection('users')
const tuitionsCollections = db.collection('tuitions')
const applicationsCollections = db.collection('applications')




app.listen(process.env.PORT || 5000, () => {
    console.log('server is running to the port 5000');
});