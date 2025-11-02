import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Switch } from '../ui/switch';
import { Checkbox } from '../ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Progress } from '../ui/progress';
import { Separator } from '../ui/separator';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '../ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { ScrollArea } from '../ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';

export function UITestDashboard() {
  const [progress, setProgress] = useState(33);
  const [switchState, setSwitchState] = useState(false);
  const [checkboxState, setCheckboxState] = useState(false);
  const [radioValue, setRadioValue] = useState("option1");

  return (
    <div className="space-y-8">
      {/* Buttons Section */}
      <Card>
        <CardHeader>
          <CardTitle>Buttons</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button disabled>Disabled</Button>
          </div>
        </CardContent>
      </Card>

      {/* Form Elements */}
      <Card>
        <CardHeader>
          <CardTitle>Form Elements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="input-test">Input Field</Label>
            <Input id="input-test" placeholder="Enter text here..." />
          </div>
          <div>
            <Label htmlFor="textarea-test">Textarea</Label>
            <Textarea id="textarea-test" placeholder="Enter longer text here..." />
          </div>
          <div className="flex items-center space-x-2">
            <Switch 
              id="switch-test" 
              checked={switchState}
              onCheckedChange={setSwitchState}
            />
            <Label htmlFor="switch-test">Toggle Switch</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="checkbox-test"
              checked={checkboxState}
              onCheckedChange={setCheckboxState}
            />
            <Label htmlFor="checkbox-test">Checkbox</Label>
          </div>
          <div>
            <Label>Radio Group</Label>
            <RadioGroup value={radioValue} onValueChange={setRadioValue}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="option1" id="option1" />
                <Label htmlFor="option1">Option 1</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="option2" id="option2" />
                <Label htmlFor="option2">Option 2</Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* Display Elements */}
      <Card>
        <CardHeader>
          <CardTitle>Display Elements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Badges</Label>
            <div className="flex gap-2 mt-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="destructive">Destructive</Badge>
              <Badge variant="outline">Outline</Badge>
            </div>
          </div>
          <div>
            <Label>Avatar</Label>
            <div className="flex gap-2 mt-2">
              <Avatar>
                <AvatarImage src="https://github.com/shadcn.png" />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback>JD</AvatarFallback>
              </Avatar>
            </div>
          </div>
          <div>
            <Label>Progress Bar</Label>
            <div className="space-y-2 mt-2">
              <Progress value={progress} />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setProgress(Math.max(0, progress - 10))}>
                  Decrease
                </Button>
                <Button size="sm" onClick={() => setProgress(Math.min(100, progress + 10))}>
                  Increase
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Interactive Elements */}
      <Card>
        <CardHeader>
          <CardTitle>Interactive Elements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Dialog</Label>
            <div className="mt-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button>Open Dialog</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Test Dialog</DialogTitle>
                  </DialogHeader>
                  <p>This is a test dialog with some content.</p>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <div>
            <Label>Dropdown Menu</Label>
            <div className="mt-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">Open Menu</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>Profile</DropdownMenuItem>
                  <DropdownMenuItem>Settings</DropdownMenuItem>
                  <DropdownMenuItem>Logout</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Data Display */}
      <Card>
        <CardHeader>
          <CardTitle>Data Display</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label>Scroll Area</Label>
              <ScrollArea className="h-32 w-full border rounded p-2 mt-2">
                <div className="space-y-2">
                  {Array.from({ length: 20 }, (_, i) => (
                    <div key={i} className="text-sm">
                      Item {i + 1} - This is scrollable content
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
            <div>
              <Label>Table</Label>
              <div className="mt-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Item 1</TableCell>
                      <TableCell><Badge>Active</Badge></TableCell>
                      <TableCell><Button size="sm">Edit</Button></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Item 2</TableCell>
                      <TableCell><Badge variant="secondary">Inactive</Badge></TableCell>
                      <TableCell><Button size="sm">Edit</Button></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}