import { v4 as uuidv4 } from "uuid";
import { Stock, Product } from "./models/Product";

export const MOCK_PRODUCTS: Product[] = [
  {
    id: uuidv4(),
    title: "Men's T-Shirt",
    description: "A comfortable cotton t-shirt for everyday wear.",
    price: 20,
  },
  {
    id: uuidv4(),
    title: "Wireless Headphones",
    description: "Noise-cancelling over-ear headphones with Bluetooth connectivity.",
    price: 150,
  },
  {
    id: uuidv4(),
    title: "Organic Apples",
    description: "Fresh organic apples, 1 lb pack.",
    price: 5,
  },
  {
    id: uuidv4(),
    title: "Running Shoes",
    description: "Lightweight running shoes with breathable material.",
    price: 75,
  },
  {
    id: uuidv4(),
    title: "Gaming Mouse",
    description: "Ergonomic gaming mouse with customizable RGB lighting.",
    price: 45,
  },
  {
    id: uuidv4(),
    title: "Smartphone",
    description: "Latest 5G smartphone with a high-resolution camera.",
    price: 999,
  },
  {
    id: uuidv4(),
    title: "Leather Wallet",
    description: "Premium leather wallet with multiple compartments.",
    price: 40,
  },
  {
    id: uuidv4(),
    title: "Instant Coffee",
    description: "Rich and aromatic instant coffee, 200g jar.",
    price: 12,
  },
  {
    id: uuidv4(),
    title: "Yoga Mat",
    description: "Non-slip yoga mat with extra cushioning for comfort.",
    price: 30,
  },
  {
    id: uuidv4(),
    title: "Bluetooth Speaker",
    description: "Portable Bluetooth speaker with 10-hour battery life.",
    price: 60,
  },
  {
    id: uuidv4(),
    title: "Electric Kettle",
    description: "1.7L stainless steel electric kettle with auto shut-off and boil-dry protection.",
    price: 35,
  },
  {
    id: uuidv4(),
    title: "Camping Tent",
    description: "Waterproof 4-person camping tent with easy setup and durable material.",
    price: 120,
  },
];

export const MOCK_STOCK: Stock[] = MOCK_PRODUCTS.map((product, index) => ({
  product_id: product.id,
  count: index + 1,
}));
