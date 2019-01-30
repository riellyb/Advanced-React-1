const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('crypto');
const { promisify } = require('util');
const { transport, makeANiceEmail } = require('../mail');

const Mutations = {
    async createItem(parent, args, context, info) {
        // TODO: Check if they are logged in

        const item = await context.db.mutation.createItem(
            {
                data: {
                    user: {
                        connect: {
                            id: context.request.userId
                        }
                    },
                    ...args
                }
            },
            info
        );

        return item;
    },
    updateItem(parent, args, context, info) {
        // first take a copy of the updates
        const updates = { ...args };
        // remove the ID from the updates
        delete updates.id;
        // run the update method
        return context.db.mutation.updateItem(
            {
                data: updates,
                where: {
                    id: args.id
                }
            },
            info
        );
    },
    async deleteItem(parent, args, context, info) {
        const where = { id: args.id };
        // 1. find item
        const item = await context.db.query.item({ where }, `{ id title }`);
        // 2. check if they own item or have permissions
        if (!context.request.userId) {
            throw new Error('You must be logged in to do that!');
        }
        // 3. delete it
        return context.db.mutation.deleteItem({ where }, info);
    },
    async signup(parent, args, context, info) {
        args.email = args.email.toLowerCase();
        // hash their password
        const password = await bcrypt.hash(args.password, 10);

        //create the user in the database
        const user = await context.db.mutation.createUser(
            {
                data: {
                    ...args,
                    password,
                    permissions: { set: ['USER'] }
                }
            },
            info
        );

        // create the JWT token for them
        const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);
        // we set the JWT token as a cookie on the response
        context.response.cookie('token', token, {
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24 * 365 //1 year token
        });
        return user;
    },
    async signin(parent, { email, password }, context, info) {
        // check if there is a user with that email
        const user = await context.db.query.user({ where: { email } });
        if (!user) {
            throw new Error(`No such user found for email ${email}`);
        }
        // check if pasword is correct
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            throw new Error('Invalid Password!');
        }
        // generate JWT token
        const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);
        // set the cookie with the token
        context.response.cookie('token', token, {
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24 * 365
        });
        // return the user
        return user;
    },
    signout(parent, args, context, info) {
        context.response.clearCookie('token');
        return { message: 'Goodbye!' };
    },
    async requestReset(parent, args, context, info) {
        // check if this is a real user
        const user = await context.db.query.user({
            where: { email: args.email }
        });
        if (!user) {
            throw new Error(`No such user found for email ${args.email}`);
        }
        // set a reset token and expiry on that user
        const randomBytesPromisified = promisify(randomBytes);
        const resetToken = (await randomBytesPromisified(20)).toString('hex');
        const resetTokenExpiry = Date.now() + 3600000;
        const res = await context.db.mutation.updateUser({
            where: { email: args.email },
            data: { resetToken, resetTokenExpiry }
        });
        // email them the reset token
        const mailRes = await transport.sendMail({
            from: 'brendanrielly@gmail.com',
            to: user.email,
            subject: 'Your password reset token',
            html: makeANiceEmail(
                `Your password reset token is here \n\n <a href="${
                    process.env.FRONTEND_URL
                }/reset?resetToken=${resetToken}">Click Here to Reset Password</a>`
            )
        });

        return { message: 'Thanks!' };
    },
    async resetPassword(parent, args, context, info) {
        // check if passwords match
        if (args.password !== args.confirmPassword) {
            throw new Error('Passwords do not match!');
        }
        // check if it's a legit reset token
        // check if it's expired
        const [user] = await context.db.query.users({
            where: {
                resetToken: args.resetToken,
                resetTokenExpiry_gte: Date.now() - 3600000
            }
        });
        if (!user) {
            throw new Error(
                'Reset password token is invalid or has expired, try resetting your password again.'
            );
        }
        // hash their new password
        const password = await bcrypt.hash(args.password, 10);

        // save their new password to the user and remove old reset token fields
        const updatedUser = await context.db.mutation.updateUser({
            where: { email: user.email },
            data: { password, resetToken: null, resetTokenExpiry: null }
        });
        // generate JWT token
        const token = jwt.sign(
            { userId: updatedUser.id },
            process.env.APP_SECRET
        );
        // set the cookie with the token
        context.response.cookie('token', token, {
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24 * 365
        });
        // return the new user
        return updatedUser;
    }
};

module.exports = Mutations;
