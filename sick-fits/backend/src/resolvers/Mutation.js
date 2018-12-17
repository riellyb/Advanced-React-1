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
    }
};

module.exports = Mutations;
