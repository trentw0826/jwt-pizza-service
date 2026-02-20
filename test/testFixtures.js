// testFixtures.js — centralised seed data for the test suite.
//
// PURPOSE: Define all well-known test fixtures as plain constants so that
// individual test files can import them by name rather than hard-coding
// values or relying on opaque beforeAll side-effects.
//
// seedTestDatabase() is called by testSetup.js (via setupFilesAfterFramework)
// before every test file. Tests that need the seeded objects can simply
// import the constants below.
//
// SEEDED COUNTS (all accessible via the returned seed object):
//   admin      — 1 named admin account
//   diner      — 1 named diner account
//   users      — 50 bulk diner accounts  (fixtures.users[i])
//   menuItems  — 10 pizza menu items     (fixtures.menuItems[i])
//   franchises — 10 franchises           (fixtures.franchises[i])
//                each with 3 stores      (fixtures.franchises[i].stores)
//   orders     — 50 orders               (one per bulk user, spread across stores)

const { DB } = require("../src/database/database.js");
const { Role } = require("../src/model/model.js");

// ---------------------------------------------------------------------------
// Static fixture definitions — import these in test files to avoid magic values
// ---------------------------------------------------------------------------

const fixtures = {
  // Named admin account with predictable credentials
  admin: {
    name: "Test Admin",
    email: "admin@test.com",
    password: "admin",
    roles: [{ role: Role.Admin }],
  },

  // Named diner account with predictable credentials
  diner: {
    name: "Test Diner",
    email: "diner@test.com",
    password: "diner",
    roles: [{ role: Role.Diner }],
  },

  // 50 bulk diner accounts. Pick any by index: fixtures.users[i].email
  // Password pattern: pass-<N>  (1-indexed)
  users: Array.from({ length: 50 }, (_, i) => ({
    name: `Bulk User ${i + 1}`,
    email: `user${i + 1}@test.com`,
    password: `pass-${i + 1}`,
    roles: [{ role: Role.Diner }],
  })),

  // 10 pizza menu items with distinct prices (0.001 * index increments)
  menuItems: [
    {
      title: "Margherita",
      description: "Classic tomato and mozzarella",
      image: "pizza1.png",
      price: 0.001,
    },
    {
      title: "Pepperoni",
      description: "Loaded with pepperoni slices",
      image: "pizza2.png",
      price: 0.0012,
    },
    {
      title: "BBQ Chicken",
      description: "Smoky BBQ sauce with chicken",
      image: "pizza3.png",
      price: 0.0015,
    },
    {
      title: "Hawaiian",
      description: "Ham and pineapple combo",
      image: "pizza4.png",
      price: 0.0018,
    },
    {
      title: "Veggie",
      description: "A garden delicious pie",
      image: "pizza5.png",
      price: 0.002,
    },
    {
      title: "Four Cheese",
      description: "Mozzarella, cheddar, gouda, brie",
      image: "pizza6.png",
      price: 0.0025,
    },
    {
      title: "Meat Lovers",
      description: "Sausage, bacon, ham, pepperoni",
      image: "pizza7.png",
      price: 0.003,
    },
    {
      title: "Buffalo",
      description: "Spicy buffalo sauce and chicken",
      image: "pizza8.png",
      price: 0.0035,
    },
    {
      title: "Mushroom",
      description: "Wild mushroom medley",
      image: "pizza9.png",
      price: 0.0038,
    },
    {
      title: "Truffle Deluxe",
      description: "Black truffle and arugula",
      image: "pizza10.png",
      price: 0.005,
    },
  ],

  // 10 franchises, each with 3 stores.
  // Admin email is resolved at seed time (bulk user[i] becomes the admin).
  franchises: Array.from({ length: 10 }, (_, i) => ({
    name: `Franchise ${i + 1}`,
    // admin email placeholder — replaced with actual bulk user email during seeding
    adminIndex: i,
    stores: Array.from({ length: 3 }, (_, j) => ({
      name: `Store ${i + 1}-${j + 1}`,
    })),
  })),

  // 50 orders — one per bulk user.
  // storeIndex and menuItemIndices are resolved to real ids during seeding.
  orders: Array.from({ length: 50 }, (_, i) => ({
    // Spread orders across the 30 stores (10 franchises x 3 stores) round-robin
    franchiseIndex: Math.floor(i / 5) % 10,
    storeIndex: i % 3,
    // Each order contains 1–3 items cycling through the menu
    items: Array.from({ length: (i % 3) + 1 }, (_, j) => ({
      menuItemIndex: (i + j) % 10,
    })),
  })),
};

// ---------------------------------------------------------------------------
// seedTestDatabase — clears all tables then inserts all fixtures above.
//
// Returned shape:
//   {
//     admin:      { id, name, email, … }
//     diner:      { id, name, email, … }
//     users:      Array<{ id, name, email, … }>           50 items
//     menuItems:  Array<{ id, title, price, … }>          10 items
//     franchises: Array<{ id, name, stores: [{ id, … }] }> 10 items, 3 stores each
//     orders:     Array<{ id, franchiseId, storeId, … }>  50 items
//   }
// ---------------------------------------------------------------------------

async function seedTestDatabase() {
  await DB.initialized;
  await DB.clearAllData();

  // ── Named users ─────────────────────────────────────────────────────────
  const admin = await DB.addUser(fixtures.admin);
  const diner = await DB.addUser(fixtures.diner);

  // ── Bulk users ───────────────────────────────────────────────────────────
  const users = [];
  for (const userData of fixtures.users) {
    users.push(await DB.addUser(userData));
  }

  // ── Menu items ───────────────────────────────────────────────────────────
  const menuItems = [];
  for (const item of fixtures.menuItems) {
    menuItems.push(await DB.addMenuItem(item));
  }

  // ── Franchises and stores ────────────────────────────────────────────────
  // Each franchise is administered by the bulk user at fixtures.franchises[i].adminIndex
  const franchises = [];
  for (const franchiseDef of fixtures.franchises) {
    const adminUser = users[franchiseDef.adminIndex];
    const franchise = await DB.createFranchise({
      name: franchiseDef.name,
      admins: [{ email: adminUser.email }],
    });

    const stores = [];
    for (const storeDef of franchiseDef.stores) {
      stores.push(await DB.createStore(franchise.id, storeDef));
    }

    franchises.push({ ...franchise, stores });
  }

  // ── Orders ───────────────────────────────────────────────────────────────
  // One order per bulk user; storeIndex and menuItemIndex are resolved here
  const orders = [];
  for (let i = 0; i < fixtures.orders.length; i++) {
    const orderDef = fixtures.orders[i];
    const franchise = franchises[orderDef.franchiseIndex];
    const store = franchise.stores[orderDef.storeIndex];

    const order = await DB.addDinerOrder(users[i], {
      franchiseId: franchise.id,
      storeId: store.id,
      items: orderDef.items.map((item) => {
        const menuItem = menuItems[item.menuItemIndex];
        return {
          menuId: menuItem.id,
          description: menuItem.description,
          price: menuItem.price,
        };
      }),
    });

    orders.push(order);
  }

  return { admin, diner, users, menuItems, franchises, orders };
}

module.exports = { fixtures, seedTestDatabase };
