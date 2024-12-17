import express from 'express';
import prisma from './prisma/prisma.js';
import logger from './lib/logger.js';
import expressLayouts from 'express-ejs-layouts';
import session from 'express-session';
import bodyParser from 'body-parser';

const app = express();
const port = 3000;

app.use(express.static('public'));
app.set('view engine', 'ejs');

app.use(expressLayouts);
app.set('layout', 'layout');

app.use(session({
    secret: 'myKey',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', async (request, response) => {
    const cart = request.session.cart || [];
    const user = request.session.user;
    const highestPrice = await prisma.product.findFirst({
        orderBy: {
            price: 'desc',
        },
    });

    const latest4Products = await prisma.product.findMany({
        orderBy: {
            created_at: 'desc',
        },
        take: 4,
    });

    const random4Products = await getRandom4Products();
    response.render('home', { highestPrice, latest4Products, random4Products, user, cart });
});

app.get('/list-product', async (request, response) => {
    const cart = request.session.cart || [];
    const user = request.session.user;
    const search = request.query.search || '';
    const categories = await prisma.category.findMany();
    const brands = await prisma.brand.findMany();
    const category = request.query.category;
    const brand = request.query.brand;
    let products;

    if (category && brand) {
        products = await prisma.product.findMany({
            where: { category_id: Number(category), brand_id: Number(brand) },
        });
    } else if (category) {
        products = await prisma.product.findMany({
            where: { category_id: Number(category) },
        });
    } else if (brand) {
        products = await prisma.product.findMany({
            where: { brand_id: Number(brand) },
        });
    } else {
        products = await prisma.product.findMany({
            where: {
                name: { contains: search, mode: 'insensitive' },
            },
        });
    }

    const latestProduct = await prisma.product.findFirst({
        orderBy: {
            created_at: 'desc',
        },
    });

    response.render('list-product', { categories, brands, products, latestProduct, user, cart });
});

app.get('/product-detail/:id', async (request, response) => {
    const cart = request.session.cart || [];
    const user = request.session.user;
    const id = request.params.id;
    if (!id || isNaN(id)) {
        return response.redirect('/');
    }
    const product = await prisma.product.findUnique({
        where: { id: Number(id) },
    });
    const random4Products = await getRandom4Products();
    response.render('product-detail', { product, random4Products, user, cart });
});

app.get('/cart', async (request, response) => {
    const cart = request.session.cart || [];
    const user = request.session.user;
    response.render('cart', { cart, user });
});

app.get('/add-to-cart', async (request, response) => {
    const id = request.query.id;
    const isAdd = request.query.isAdd === 'true';
    if (!id || isNaN(id)) {
        return response.redirect('/');
    }
    const product = await prisma.product.findUnique({
        where: { id: Number(id) },
    });
    const cart = request.session.cart || [];
    const productIndex = cart.findIndex(item => item.id === Number(id));
    if (isAdd) {
        if (productIndex !== -1) {
            cart[productIndex].quantity += 1;
        } else {
            cart.push({ id: product.id, name: product.name, price: product.price, image: product.image, quantity: 1 });
        }
    } else {
        if (productIndex !== -1) {
            cart.splice(productIndex, 1);
        }
    }
    request.session.cart = cart;
    response.redirect(request.headers.referer || '/');
});

app.get('/contact', async (request, response) => {
    const user = request.session.user;
    const cart = request.session.cart || [];
    response.render('contact', { user, cart });
});

app.get('/login', async (request, response) => {
    const user = request.session.user;
    if (user) {
        return response.redirect('/');
    }
    response.render('login', { layout: false, error: {} });
});

app.post('/login', async (request, response) => {
    const username = request.body.username;
    const password = request.body.password;
    if (!username) {
        return response.render('login', { layout: false, error: { username: 'Username is required' } });
    }
    if (!password) {
        return response.render('login', { layout: false, error: { password: 'Password is required' } });
    }
    const user = await prisma.account.findFirst({
        where: { username, password },
    });
    if (!user) {
        return response.render('login', { layout: false, error: { account: 'Username or password is incorrect' } });
    }
    request.session.user = user;
    response.redirect('/');
});

app.get('/signup', async (request, response) => {
    const user = request.session.user;
    if (user) {
        return response.redirect('/');
    }
    response.render('signup', { layout: false, error: {} });
});

app.post('/signup', async (request, response) => {
    const name = request.body.name;
    const username = request.body.username;
    const password = request.body.password;
    const confirmPassword = request.body.confirmPassword;
    if (!name) {
        return response.render('signup', { layout: false, error: { name: 'Name is required' } });
    }
    if (!username) {
        return response.render('signup', { layout: false, error: { username: 'Username is required' } });
    }
    if (!password) {
        return response.render('signup', { layout: false, error: { password: 'Password is required' } });
    }
    if (password !== confirmPassword) {
        return response.render('signup', { layout: false, error: { confirmPassword: 'Password does not match' } });
    }
    const user = await prisma.account.create({
        data: { name, username, password },
    });
    request.session.user = user;
    response.redirect('/');
});

app.get('/logout', async (request, response) => {
    request.session.destroy();
    response.redirect('/');
});

app.get('/checkout', async (request, response) => {
    const user = request.session.user;
    const cart = request.session.cart || [];
    response.render('checkout', { layout: false, user, cart });
});

app.listen(port, () => {
    logger.info(`App is running at http://localhost:${port}`);
});

async function getRandom4Products() {
    const records = await prisma.product.findMany({
        select: { id: true },
    });
    const shuffled = records.sort(() => 0.5 - Math.random());
    const selectedIds = shuffled.slice(0, 4).map(record => record.id);
    return await prisma.product.findMany({
        where: { id: { in: selectedIds } },
    });
}
