import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OvertimeRequestForm from "@/components/overtime/OvertimeRequestForm";
import OvertimeRequestsList from "@/components/overtime/OvertimeRequestsList";

const Overtime = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRequestSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <Tabs defaultValue="request" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="request">New Request</TabsTrigger>
          <TabsTrigger value="history">My Requests</TabsTrigger>
        </TabsList>
        
        <TabsContent value="request" className="space-y-6">
          <OvertimeRequestForm onSuccess={handleRequestSuccess} />
        </TabsContent>
        
        <TabsContent value="history" className="space-y-6">
          <div key={refreshKey}>
            <OvertimeRequestsList />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Overtime;