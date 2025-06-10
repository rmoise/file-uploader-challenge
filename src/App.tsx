import { useState } from "react";
import { Page, Card, Button, Text, BlockStack } from "@shopify/polaris";

function App() {
  const [count, setCount] = useState(0);

  return (
    <Page
      title="File Uploader Challenge"
      subtitle="React file uploader with queue management and retry logic"
    >
      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">
            Polaris Setup Test
          </Text>
          <Text as="p">
            Testing Polaris components and styling. Count: {count}
          </Text>
          <Button
            variant="primary"
            onClick={() => setCount((count) => count + 1)}
          >
            Test Polaris Button
          </Button>
          <Text as="p" tone="subdued">
            ✅ If you can see this styled page with the button working, Polaris
            is set up correctly!
          </Text>
        </BlockStack>
      </Card>
    </Page>
  );
}

export default App;
