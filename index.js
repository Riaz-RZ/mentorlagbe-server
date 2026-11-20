import express from 'express';
import cors from 'cors';
import 'dotenv/config'

const app = express();

app.use(cors());
app.use(express.json());


app.listen(process.env.PORT || 5000, () => {
    console.log('server is running to the port 5000');
});