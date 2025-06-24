import { Routes, Route } from "react-router-dom";
import MainLayout from "~/components/MainLayout/MainLayout";
import PageProductForm from "~/components/pages/PageProductForm/PageProductForm";
import PageOrders from "~/components/pages/PageOrders/PageOrders";
import PageOrder from "~/components/pages/PageOrder/PageOrder";
import PageProductImport from "~/components/pages/admin/PageProductImport/PageProductImport";
import PageCart from "~/components/pages/PageCart/PageCart";
import PageProducts from "~/components/pages/PageProducts/PageProducts";
import { Typography } from "@mui/material";
import PageLogin from "~/components/pages/PageLogin/PageLogin";
import RequireAuth from "~/components/RequireAuth";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<PageLogin />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <MainLayout>
              <Routes>
                <Route path="/" element={<PageProducts />} />
                <Route path="cart" element={<PageCart />} />
                <Route path="admin/orders">
                  <Route index element={<PageOrders />} />
                  <Route path=":id" element={<PageOrder />} />
                </Route>
                <Route path="admin/products" element={<PageProductImport />} />
                <Route path="admin/product-form">
                  <Route index element={<PageProductForm />} />
                  <Route path=":id" element={<PageProductForm />} />
                </Route>
                <Route
                  path="*"
                  element={<Typography variant="h1">Not found</Typography>}
                />
              </Routes>
            </MainLayout>
          </RequireAuth>
        }
      />
    </Routes>
  );
}

export default App;
