import { main as getProductsList } from "lib/product-service/handlers/getProductsList/handler";
import { availableProducts } from "mock-data/index";
import { AvailableProduct } from "mock-data/models/Product";

describe("getProductsList Lambda Function", () => {
  it("should return the list of available products", async () => {
    const res = await getProductsList();
    const products: AvailableProduct[] = JSON.parse(res.products);

    expect(products).toEqual(availableProducts);
  });

  it("should return an array of products with the correct structure", async () => {
    const res = await getProductsList();
    const products: AvailableProduct[] = JSON.parse(res.products);

    products.forEach((product) => {
      expect(product).toHaveProperty("id");
      expect(product).toHaveProperty("title");
      expect(product).toHaveProperty("description");
      expect(product).toHaveProperty("price");
      expect(product).toHaveProperty("count");

      expect(typeof product.id).toBe("string");
      expect(typeof product.title).toBe("string");
      expect(typeof product.description).toBe("string");
      expect(typeof product.price).toBe("number");
      expect(typeof product.count).toBe("number");
    });
  });
});
