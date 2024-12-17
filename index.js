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

app.post('/checkout', async (request, response) => {
    //delete cart
    request.session.cart = [];
    response.redirect('/');
});

app.get('/admin/account-management', async (request, response) => {
    const cart = request.session.cart || [];
    const user = request.session.user;
    const status = request.query.status;
    if (!user || user.role_id !== 1) {
        return response.redirect('/');
    }
    const accounts = await prisma.account.findMany({
        where: { id: { not: 1 } },
        orderBy: {
            id: 'asc',
        },
        include: { Role: true },
    });
    response.render('admin/account-management', { layout: false, accounts, user, cart, error: status === '0' ? 'Username đã tồn tại' : '', success: status === '1' ? 'Thêm tài khoản thành công' : '' });
});

app.get('/admin/brand-management', async (request, response) => {
    const cart = request.session.cart || [];
    const user = request.session.user;
    const status = request.query.status;
    if (!user || user.role_id !== 1) {
        return response.redirect('/');
    }
    const brands = await prisma.brand.findMany({
        orderBy: {
            id: 'asc',
        },
    });
    response.render('admin/brand-management', { layout: false, brands, user, cart, error: status === '0' ? 'Tên thương hiệu đã tồn tại' : '', success: status === '1' ? 'Thêm thương hiệu thành công' : '' });
});

app.get('/admin/category-management', async (request, response) => {
    const cart = request.session.cart || [];
    const user = request.session.user;
    const status = request.query.status;
    if (!user || user.role_id !== 1) {
        return response.redirect('/');
    }
    const categories = await prisma.category.findMany({
        orderBy: {
            id: 'asc',
        },
    });
    response.render('admin/category-management', { layout: false, categories, user, cart, error: status === '0' ? 'Tên danh mục đã tồn tại' : '', success: status === '1' ? 'Thêm danh mục thành công' : '' });
});

app.get('/admin/product-management', async (request, response) => {
    const categories = await prisma.category.findMany();
    const brands = await prisma.brand.findMany();
    const cart = request.session.cart || [];
    const user = request.session.user;
    const status = request.query.status;
    if (!user || user.role_id !== 1) {
        return response.redirect('/');
    }
    const products = await prisma.product.findMany({
        orderBy: {
            id: 'asc',
        },
    });
    response.render('admin/product-management', { layout: false, products, categories, brands, user, cart, error: status === '0' ? 'Tên sản phẩm đã tồn tại' : '', success: status === '1' ? 'Thêm sản phẩm thành công' : '' });
});

app.post('/admin/add-account', async (request, response) => {
    const user = request.session.user;
    if (!user || user.role_id !== 1) {
        return response.redirect('/');
    }
    const name = request.body.name;
    const username = request.body.username;
    const password = request.body.password;
    const role = request.body.role;
    const userExist = await prisma.account.findFirst({
        where: { username },
    });
    if (userExist) {
        return response.redirect('/admin/account-management?status=0');
    }
    await prisma.account.create({
        data: { name, username, password, role_id: Number(role) },
    });
    response.redirect('/admin/account-management?status=1');
});

app.post('/admin/edit-account', async (request, response) => {
    const id = request.body.id;
    const name = request.body.name;
    const role = request.body.role;
    await prisma.account.update({
        where: { id: Number(id) },
        data: { name, role_id: Number(role) },
    });
    response.redirect('/admin/account-management');
});

app.get('/admin/delete-account/:id', async (request, response) => {
    const id = request.params.id;
    await prisma.account.delete({
        where: { id: Number(id) },
    });
    response.redirect('/admin/account-management');
});

app.post('/admin/add-brand', async (request, response) => {
    const user = request.session.user;
    if (!user || user.role_id !== 1) {
        return response.redirect('/');
    }
    const name = request.body.name;
    const brandExist = await prisma.brand.findFirst({
        where: { name },
    });
    if (brandExist) {
        return response.redirect('/admin/brand-management?status=0');
    }
    await prisma.brand.create({
        data: { name },
    });
    response.redirect('/admin/brand-management?status=1');
});

app.post('/admin/edit-brand', async (request, response) => {
    const id = request.body.id;
    const name = request.body.name;
    await prisma.brand.update({
        where: { id: Number(id) },
        data: { name },
    });
    response.redirect('/admin/brand-management');
});

app.get('/admin/delete-brand/:id', async (request, response) => {
    const id = request.params.id;
    await prisma.brand.delete({
        where: { id: Number(id) },
    });
    response.redirect('/admin/brand-management');
});

app.post('/admin/add-category', async (request, response) => {
    const user = request.session.user;
    if (!user || user.role_id !== 1) {
        return response.redirect('/');
    }
    const name = request.body.name;
    const categoryExist = await prisma.category.findFirst({
        where: { name },
    });
    if (categoryExist) {
        return response.redirect('/admin/category-management?status=0');
    }
    await prisma.category.create({
        data: { name },
    });
    response.redirect('/admin/category-management?status=1');
});

app.post('/admin/edit-category', async (request, response) => {
    const id = request.body.id;
    const name = request.body.name;
    await prisma.category.update({
        where: { id: Number(id) },
        data: { name },
    });
    response.redirect('/admin/category-management');
});

app.get('/admin/delete-category/:id', async (request, response) => {
    const id = request.params.id;
    await prisma.category.delete({
        where: { id: Number(id) },
    });
    response.redirect('/admin/category-management');
});

app.post('/admin/add-product', async (request, response) => {
    const user = request.session.user;
    if (!user || user.role_id !== 1) {
        return response.redirect('/');
    }
    const { name, price, category_id, brand_id, image, description } = request.body;
    const productExist = await prisma.product.findFirst({
        where: { name },
    });
    if (productExist) {
        return response.redirect('/admin/product-management?status=0');
    }
    await prisma.product.create({
        data: { name, price: Number(price), category_id: Number(category_id), brand_id: Number(brand_id), account_id: user.id, image, description },
    });
    response.redirect('/admin/product-management?status=1');
});

app.post('/admin/edit-product', async (request, response) => {
    const id = request.body.id;
    const { name, price, category_id, brand_id, image, description } = request.body;
    await prisma.product.update({
        where: { id: Number(id) },
        data: { name, price: Number(price), category_id: Number(category_id), brand_id: Number(brand_id), image, description },
    });
    response.redirect('/admin/product-management');
});

app.get('/admin/delete-product/:id', async (request, response) => {
    const id = request.params.id;
    await prisma.product.delete({
        where: { id: Number(id) },
    });
    response.redirect('/admin/product-management');
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
