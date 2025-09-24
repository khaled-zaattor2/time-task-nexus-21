import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock, Eye } from "lucide-react";

interface OvertimeRequest {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  hours: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  profiles: {
    full_name: string;
    email: string;
  } | null;
}

const OvertimeApproval = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<OvertimeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<OvertimeRequest | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchOvertimeRequests();
  }, []);

  const fetchOvertimeRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('overtime_requests')
        .select(`
          *,
          profiles (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests((data as any) || []);
    } catch (error) {
      console.error('Error fetching overtime requests:', error);
      toast({
        title: "Error",
        description: "Failed to load overtime requests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (requestId: string, status: 'approved' | 'rejected') => {
    if (!user) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('overtime_requests')
        .update({
          status,
          approved_by: user.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Overtime request ${status} successfully`,
      });

      fetchOvertimeRequests();
      setSelectedRequest(null);
    } catch (error) {
      console.error('Error updating overtime request:', error);
      toast({
        title: "Error",
        description: "Failed to update overtime request",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="default" className="bg-green-500">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const pendingRequests = requests.filter(req => req.status === 'pending');
  const processedRequests = requests.filter(req => req.status !== 'pending');

  if (loading) {
    return <div className="flex justify-center p-8">Loading overtime requests...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Pending Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Overtime Requests
            {pendingRequests.length > 0 && (
              <Badge variant="secondary">{pendingRequests.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Review and approve overtime requests from your team
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No pending overtime requests</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{request.profiles?.full_name || 'Unknown'}</div>
                          <div className="text-sm text-muted-foreground">{request.profiles?.email || 'No email'}</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {format(new Date(request.date), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          {format(new Date(request.start_time), 'HH:mm')} - 
                          {format(new Date(request.end_time), 'HH:mm')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{request.hours}h</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(request.created_at), 'MMM dd, HH:mm')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedRequest(request)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleApproval(request.id, 'approved')}
                            disabled={actionLoading}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleApproval(request.id, 'rejected')}
                            disabled={actionLoading}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Processed Requests */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Processed Requests</CardTitle>
          <CardDescription>
            Previously approved or rejected overtime requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {processedRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No processed requests</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Processed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedRequests.slice(0, 10).map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div className="font-medium">{request.profiles?.full_name || 'Unknown'}</div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(request.date), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{request.hours}h</span>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(request.status)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {request.approved_at && format(new Date(request.approved_at), 'MMM dd, HH:mm')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Request Details Dialog */}
      {selectedRequest && (
        <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Overtime Request Details</DialogTitle>
              <DialogDescription>
                Review the overtime request from {selectedRequest.profiles?.full_name || 'Unknown Employee'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Employee</label>
                  <p className="text-sm text-muted-foreground">{selectedRequest.profiles?.full_name || 'Unknown'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Date</label>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(selectedRequest.date), 'EEEE, MMMM dd, yyyy')}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Time Period</label>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(selectedRequest.start_time), 'HH:mm')} - 
                    {format(new Date(selectedRequest.end_time), 'HH:mm')}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Total Hours</label>
                  <p className="text-sm text-muted-foreground font-medium">{selectedRequest.hours} hours</p>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium">Reason for Overtime</label>
                <Textarea
                  value={selectedRequest.reason}
                  readOnly
                  className="mt-1 resize-none"
                  rows={4}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setSelectedRequest(null)}
              >
                Close
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleApproval(selectedRequest.id, 'rejected')}
                disabled={actionLoading}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={() => handleApproval(selectedRequest.id, 'approved')}
                disabled={actionLoading}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default OvertimeApproval;