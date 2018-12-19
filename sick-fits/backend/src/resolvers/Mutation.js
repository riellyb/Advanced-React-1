const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const Mutations = {
    async createItem(parent, args, context, info) {
        // TODO: Check if they are logged in

        const item = await context.db.mutation.createItem({
            data: {
                ...args
            }
        }, info);

        return item;
    },
    updateItem(parent, args, context, info) {
        // first take a copy of the updates
        const updates = { ...args };
        // remove the ID from the updates
        delete updates.id;
        // run the update method
        return context.db.mutation.updateItem({
            data: updates,
            where: {
                id: args.id,
            }
        },
            info
        )
    },
    async deleteItem(parent, args, context, info) {
        const where = { id: args.id };
        // 1. find item
        const item = await context.db.query.item({ where }, `{ id title }`);
        // 2. check if they own item or have permissions
        // TODO
        // 3. delete it
        return context.db.mutation.deleteItem({ where }, info);
    },
    async signup(parent, args, context, info) {
        args.email = args.email.toLowerCase();
        // hash their password
        const password = await bcrypt.hash(args.password, 10);

        //create the user in the database
        const user = await context.db.mutation.createUser({
            data: {
                ...args,
                password,
                permissions: { set: ['USER'] },
            }
        }, info);

        // create the JWT token for them
        const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);
        // we set the JWT token as a cookie on the response
        context.response.cookie('token', token, {
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24 * 365, //1 year token
        });
        return user;
    }
};

module.exports = Mutations;
