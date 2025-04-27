import { main as getProductsById } from "lib/product-service/handlers/getProductsById/handler";
import { availableProducts } from "mock-data/index";
import { AvailableProduct } from "mock-data/models/Product";

describe("getProductsById Lambda Function", () => {
  it("should return the product by given ID", async () => {
    const res = await getProductsById({
      pathParameters: {
        productId: "7567ec4b-b10c-48c5-9345-fc73c48a80aa",
      },
    } as any);
    const product: AvailableProduct[] = JSON.parse(res.body ?? "");

    expect(product).toEqual(availableProducts[0]);
  });

  it("should return [null] when no product is found", async () => {
    const res = await getProductsById({
      pathParameters: {
        productId: "invalid id",
      },
    } as any);
    const product: AvailableProduct[] = JSON.parse(res.body ?? "");

    expect(product).toBeNull();
  });
});
