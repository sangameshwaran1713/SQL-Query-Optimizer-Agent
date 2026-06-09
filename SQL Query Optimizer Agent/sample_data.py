"""
Run this once to create demo.db with sample data.
Usage: python sample_data.py
"""
import sqlite3
import random
import string
from datetime import datetime, timedelta

DB_PATH = "demo.db"


def random_string(n=8):
    return ''.join(random.choices(string.ascii_lowercase, k=n))


def random_date(start_year=2020, end_year=2024):
    start = datetime(start_year, 1, 1)
    end = datetime(end_year, 12, 31)
    delta = end - start
    return (start + timedelta(days=random.randint(0, delta.days))).strftime("%Y-%m-%d")


def seed_database():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.executescript("""
        DROP TABLE IF EXISTS orders;
        DROP TABLE IF EXISTS customers;
        DROP TABLE IF EXISTS products;
        DROP TABLE IF EXISTS order_items;

        CREATE TABLE customers (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            city TEXT,
            country TEXT,
            created_at TEXT
        );

        CREATE TABLE products (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT,
            price REAL,
            stock INTEGER
        );

        CREATE TABLE orders (
            id INTEGER PRIMARY KEY,
            customer_id INTEGER,
            status TEXT,
            total_amount REAL,
            created_at TEXT,
            FOREIGN KEY (customer_id) REFERENCES customers(id)
        );

        CREATE TABLE order_items (
            id INTEGER PRIMARY KEY,
            order_id INTEGER,
            product_id INTEGER,
            quantity INTEGER,
            unit_price REAL,
            FOREIGN KEY (order_id) REFERENCES orders(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        );
    """)

    print("Tables created. Seeding data...")

    # Insert 5000 customers
    customers = []
    cities = ["Mumbai", "Delhi", "Bangalore", "Chennai", "Hyderabad", "Pune", "Kolkata"]
    countries = ["India", "USA", "UK", "Germany", "France"]
    for i in range(1, 5001):
        customers.append((
            i,
            f"Customer_{random_string(6)}",
            f"user{i}@{random_string(5)}.com",
            random.choice(cities),
            random.choice(countries),
            random_date()
        ))
    cursor.executemany("INSERT INTO customers VALUES (?,?,?,?,?,?)", customers)

    # Insert 1000 products
    categories = ["Electronics", "Clothing", "Books", "Food", "Sports", "Toys"]
    products = []
    for i in range(1, 1001):
        products.append((
            i,
            f"Product_{random_string(6)}",
            random.choice(categories),
            round(random.uniform(10, 5000), 2),
            random.randint(0, 500)
        ))
    cursor.executemany("INSERT INTO products VALUES (?,?,?,?,?)", products)

    # Insert 20000 orders
    statuses = ["pending", "shipped", "delivered", "cancelled"]
    orders = []
    for i in range(1, 20001):
        orders.append((
            i,
            random.randint(1, 5000),
            random.choice(statuses),
            round(random.uniform(100, 50000), 2),
            random_date()
        ))
    cursor.executemany("INSERT INTO orders VALUES (?,?,?,?,?)", orders)

    # Insert 50000 order_items
    items = []
    for i in range(1, 50001):
        items.append((
            i,
            random.randint(1, 20000),
            random.randint(1, 1000),
            random.randint(1, 10),
            round(random.uniform(10, 5000), 2)
        ))
    cursor.executemany("INSERT INTO order_items VALUES (?,?,?,?,?)", items)

    conn.commit()
    conn.close()
    print("Done! Seeded: 5000 customers, 1000 products, 20000 orders, 50000 order_items")
    print(f"Database saved to: {DB_PATH}")


if __name__ == "__main__":
    seed_database()