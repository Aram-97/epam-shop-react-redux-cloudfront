import { availableProducts } from "mock-data/index";

interface ReturnType {
  products: string;
}

export const main = async (): Promise<ReturnType> => {
  return {
    products: JSON.stringify(availableProducts),
  };
};
