/**
 * User Select Filter Component
 * 
 * Searchable user selection filter that loads users from a backend endpoint.
 * Perfect for filtering by "Created By", "Assigned To", etc.
 */

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../command";
import { Button } from "../button";
// import { Badge } from "../badge";
import { cn } from "../../lib/utils";
interface User {
  id: string;
  name?: string;
  email?: string;
  avatar?: string;
}

interface UserSelectFilterProps {
  value: string | undefined;
  onValueChange: (value: string | undefined) => void;
  users: User[];
  isLoading?: boolean;
  valueKey?: string; // Default: 'id'
  displayKey?: string; // Default: 'name'
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  searchable?: boolean;
}

export function UserSelectFilter({
  value,
  onValueChange,
  users,
  isLoading = false,
  valueKey = "id",
  displayKey = "name",
  placeholder = "Select user...",
  label,
  disabled = false,
  searchable = true,
}: UserSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Find selected user
  const selectedUser = users.find((user: any) => user[valueKey] === value);
  const selectedLabel = selectedUser ? getDisplayName(selectedUser, displayKey) : undefined;

  function getDisplayName(user: any, key: string): string {
    if (key.includes('.')) {
      const keys = key.split('.');
      let result = user;
      for (const k of keys) {
        result = result?.[k];
      }
      return result || user.email || 'Unknown User';
    }
    return user[key] || user.email || 'Unknown User';
  }

  // Filter users based on search term
  const filteredUsers = searchTerm
    ? users.filter((user: any) => {
        const name = getDisplayName(user, displayKey).toLowerCase();
        const email = user.email?.toLowerCase() || '';
        return name.includes(searchTerm.toLowerCase()) || email.includes(searchTerm.toLowerCase());
      })
    : users;

  return (
    <div className="flex flex-col space-y-1">
      {label && (
        <label className="text-xs font-medium text-muted-foreground">
          {label}
        </label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[200px] justify-between h-8 font-normal"
            disabled={disabled}
          >
            {selectedLabel || placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0" align="start">
          <Command>
            {searchable && (
              <CommandInput
                placeholder="Search users..."
                value={searchTerm}
                onValueChange={setSearchTerm}
              />
            )}
            <CommandList>
              {isLoading ? (
                <CommandEmpty>Loading users...</CommandEmpty>
              ) : filteredUsers.length === 0 ? (
                <CommandEmpty>No users found.</CommandEmpty>
              ) : (
                <CommandGroup>
                  <CommandItem
                    value="all"
                    onSelect={() => {
                      onValueChange(undefined);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        !value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    All Users
                  </CommandItem>
                  {filteredUsers.map((user: any) => (
                    <CommandItem
                      key={user[valueKey]}
                      value={user[valueKey]}
                      onSelect={() => {
                        onValueChange(user[valueKey]);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === user[valueKey] ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {getDisplayName(user, displayKey)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}