// load the modules and libraries needed
const express = require('express');
const handlebars = require('express-handlebars');
const mysql = require('mysql2/promise');

// configure the port
const PORT = parseInt(process.argv[2]) || parseInt(process.env.PORT) || 3000;

// SQL commands
const SQL_QUERY_TV_NAMES_DESC = "select tvid, name from tv_shows order by name desc limit ? offset ?";
const SQL_GET_TV_DETAILS_BY_ID = "select * from tv_shows where tvid like ?";

// define global constants
const QUERYLIMIT = parseInt(process.env.DB_QUERY_LIMIT) || 20;

// create an instance of express
const app = express();

// configure handlebars
app.engine('hbs', handlebars({ defaultLayout: 'default.hbs' }));
app.set('view engine', 'hbs');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'db4free.net',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PW,
    database: process.env.DB_NAME || 'jtano_leisure_db',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 4,
    timezone: '+08:00'
});

// creating specific helper query functions using the concept of closures.. simplify calling process
const mkQuery = (sqlStmt, dbPool) => {
    const f = async (params) => {
        const conn = await dbPool.getConnection();

        try {
            const results = await conn.query(sqlStmt, params);
            return results[0];
        } catch (e) {
            return Promise.reject(e);
        } finally {
            conn.release();
        }
    }
    return f;
}

const getTVList = mkQuery(SQL_QUERY_TV_NAMES_DESC, pool);
const getTVDetails = mkQuery(SQL_GET_TV_DETAILS_BY_ID, pool);

const startApp = async (newApp, newPool) => {
    try {
        const conn = await newPool.getConnection();
        console.info('We are pinging the database..');

        await conn.ping();

        // after confirming that the connection can be established, release the connection back to reserve
        conn.release();

        // start the express server
        newApp.listen(PORT, () => {
            console.info(`Server was started at port ${PORT} on ${new Date()}`);
        });
    } catch(e) {
        console.error("Cannot ping database.. ", e);
    }
};

app.get('/', async (req, res, next) => {
    let currOffset = parseInt(req.query['offset']) || 0;
    console.info("Current Offset: ", currOffset);

    if(req.query['btnPressed'] === 'prev') {
        currOffset = Math.max(0, currOffset - QUERYLIMIT);
    } else if(req.query['btnPressed'] === 'next') {
        currOffset += QUERYLIMIT;
    }
    console.info("New Current Offset: ", currOffset);

    // const conn = await pool.getConnection();

    try {
        // const results = await conn.query(SQL_QUERY_TV_NAMES_DESC, [QUERYLIMIT]);
        const tvPrograms = await getTVList([QUERYLIMIT, currOffset]);

        res.format({
            default: () => {
                res.status(200).type('text/html');
                res.render('index', { hasShows: tvPrograms.length > 0, tvShow: tvPrograms, offset: currOffset });
            }
        });
    } catch(e) {
        console.error('Could not load landing page. Error: ', e);
        res.status(500).type('text/html');
        res.send('<h2>Unable to load landing page due to an Internal Server error!</h2>');
    }/* finally {
        conn.release();
    }*/
});

app.get('/app/:tvid', async (req, res, next) => {
    // const conn = await pool.getConnection();

    try {
        // const results = await conn.query(SQL_GET_TV_DETAILS_BY_ID, [req.params['tvid']]);
        const tvShow = await getTVDetails([req.params['tvid']]);

        // console.info("details of TV SHow is ", tvShow);

        res.format({
            default: () => {
                res.status(200).type('text/html');
                res.render('details', { tvName: tvShow[0].name, tvRating: tvShow[0].rating, tvImage: tvShow[0].image, tvSummary: tvShow[0].summary, tvSite: tvShow[0].official_site });
            }
        });
    } catch (e) {
        console.error(`Unable to load TV with TVID: ${req.params['tvid']}`);
        res.status(404).type('text/html');
        res.send(`<h2>Unable to load page with TVID: ${req.params['tvid']}`);
    }/* finally {
        conn.release();
    }*/
});

startApp(app, pool);