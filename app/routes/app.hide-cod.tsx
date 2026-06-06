import { useEffect } from "react";
import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Button,
  Text,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { useAppBridge } from "@shopify/app-bridge-react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  // Query the store for all installed functions
  const functionsResponse = await admin.graphql(
    `#graphql
    query {
      shopifyFunctions(first: 50) {
        nodes {
          id
          title
          apiType
        }
      }
    }`
  );
  
  const functionsJson = await functionsResponse.json();
  const shopifyFunctions = functionsJson.data?.shopifyFunctions?.nodes || [];

  // Try to find the function ID from environment variables first
  let functionId = process.env.SHOPIFY_HIDE_COD_ID;

  // Fallback: Try to find it dynamically from the store's installed functions!
  if (!functionId) {
    const codFunction = shopifyFunctions.find((f: any) => 
      f.apiType === "payment_customization" || 
      f.title?.includes("hide-cod") || 
      f.title?.includes("hide")
    );
    if (codFunction) {
      functionId = codFunction.id;
    }
  }

  if (!functionId) {
    return json({ 
      error: "Function hasn't been uploaded to Shopify yet. Keep your 'npm run dev' running or hit 'npm run deploy' to push it.", 
      debug: shopifyFunctions 
    }, { status: 400 });
  }

  const response = await admin.graphql(
    `#graphql
      mutation paymentCustomizationCreate($input: PaymentCustomizationInput!) {
        paymentCustomizationCreate(paymentCustomization: $input) {
          paymentCustomization {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      variables: {
        input: {
          functionId: functionId,
          title: "Hide COD (Free Gift rule)",
          enabled: true,
        },
      },
    }
  );

  const responseJson = await response.json();
  const errors = responseJson.data?.paymentCustomizationCreate?.userErrors || [];

  if (errors.length > 0) {
    return json({ error: errors[0].message });
  }

  return json({ success: true });
};

export default function HideCodActivation() {
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const isSaving = fetcher.state === "submitting" || fetcher.state === "loading";
  const actionData = fetcher.data;

  useEffect(() => {
    if (actionData?.success) {
      shopify.toast.show("Activating customization was successful");
    } else if (actionData?.error) {
      shopify.toast.show("Error activating customization");
    }
  }, [actionData, shopify]);

  return (
    <Page title="Free Gift COD Rules">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                How It Works
              </Text>
              <Text as="p" variant="bodyMd">
                This extension will automatically hide the <strong>Cash on Delivery (COD)</strong> option at checkout if the customer's cart contains any product tagged with <code>free-gift</code>.
              </Text>
              <Text as="p" variant="bodyMd">
                <strong>Step 1:</strong> Go to your Shopify Products and add the exact tag <code>free-gift</code> to your free/gift product.
              </Text>
              <Text as="p" variant="bodyMd">
                <strong>Step 2:</strong> Click Activate Extension below to enable the rule on your store.
              </Text>

              {actionData?.error && (
                <Text as="p" variant="bodyMd" tone="critical">
                  Error: {actionData.error}
                </Text>
              )}

              {actionData?.success && (
                <Text as="p" variant="bodyMd" tone="success">
                  Successfully activated! The rule is now running in your store.
                </Text>
              )}

              <Button
                variant="primary"
                onClick={() => fetcher.submit({}, { method: "POST" })}
                loading={isSaving}
                disabled={actionData?.success}
              >
                {actionData?.success ? "Activated" : "Activate Extension"}
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
