// Sample file with intentional issues for code review demonstration
import axios from "axios";   // unused import
import { readFileSync } from "fs";

// SECURITY: hardcoded API key
const API_KEY = "sk-prod-a8f3k2m9x1q7n4b6c0w5e8r2t1y9p3l";
const DB_PASSWORD = "super_secret_password_123!";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface Product {
  id: number;
  name: string;
  price: number;
}

// STYLE: single-letter variable name, poor naming
function calculate(x: number, y: number): number {
  let z = x * y;
  return z;
}

// SECURITY: XSS vulnerability — unsanitized user input injected into DOM
function renderUserComment(comment: string): string {
  return `<div class="comment">${comment}</div>`;
}

// STYLE: unused variable
function processData(users: User[]): void {
  const temp = "unused string variable";
  console.log(`Processing ${users.length} users`);
}

// PERFORMANCE: O(n²) — .find() inside a loop instead of using a Map
function getUserOrders(users: User[], orders: Array<{ userId: number; amount: number }>): void {
  for (const order of orders) {
    // This scans the entire users array for every order — O(n²)
    const user = users.find((u) => u.id === order.userId);
    if (user) {
      console.log(`${user.name} ordered $${order.amount}`);
    }
  }
}

// SECURITY: SQL injection via string concatenation
function buildQuery(userId: string): string {
  return `SELECT * FROM users WHERE id = '${userId}'`;
}

// PERFORMANCE: repeated expensive operation in a loop, memory leak via uncleared interval
let intervalId: ReturnType<typeof setInterval>;

function startPolling(url: string): void {
  intervalId = setInterval(async () => {
    const users: User[] = [];
    // Simulated fetch inside interval (interval never cleared — memory leak)
    for (let i = 0; i < 1000; i++) {
      // PERFORMANCE: large array allocation on each tick
      users.push({ id: i, name: `user${i}`, email: `user${i}@example.com`, role: "member" });
    }
    console.log(`Polled ${users.length} records from ${url}`);
  }, 5000);
}

// STYLE: magic numbers with no named constants
function applyDiscount(price: number, tier: number): number {
  if (tier === 1) return price * 0.95;
  if (tier === 2) return price * 0.85;
  if (tier === 3) return price * 0.70;
  return price;
}

// PERFORMANCE: N+1 pattern — simulated DB call inside loop
async function loadProductDetails(productIds: number[]): Promise<Product[]> {
  const results: Product[] = [];
  for (const id of productIds) {
    // Each iteration makes an independent "database" call
    const product = await fetchProductFromDB(id);
    results.push(product);
  }
  return results;
}

async function fetchProductFromDB(id: number): Promise<Product> {
  // Simulates a real DB round-trip
  return new Promise((resolve) =>
    setTimeout(() => resolve({ id, name: `Product ${id}`, price: id * 9.99 }), 10)
  );
}

export { calculate, renderUserComment, processData, getUserOrders, buildQuery, startPolling, applyDiscount, loadProductDetails };
