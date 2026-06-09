import sqlite3

conn = sqlite3.connect("demo.db")
cursor = conn.cursor()

cursor.executescript("""
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_customers_country ON customers(country);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
""")

conn.commit()
conn.close()
print("All indexes created successfully!")